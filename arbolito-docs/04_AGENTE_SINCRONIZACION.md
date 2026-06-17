# 04 — Agente de Sincronización (Eleventa ↔ Cloud)

> **Este es el componente más delicado del sistema.** Resuelve el problema central: mantener un solo inventario sincronizado entre el evento físico (Eleventa) y la tienda online, sobreviviendo cortes de internet y reinicios de la PC.

---

## A. Datos Técnicos de Eleventa (confirmados)

- Eleventa guarda **todo en un archivo Firebird**: `PDVDATA.FDB`.
- Ubicación típica: `C:\Archivos de Programa\AbarrotesPDV\db\PDVDATA.FDB`.
- Es la misma base de "Abarrotes Punto de Venta".
- Firebird **bloquea el archivo** mientras Eleventa lo usa.

### ⚠️ Regla de oro
**El agente NUNCA escribe en el `.FDB` mientras Eleventa está abierto.** Hacerlo puede corromper la base y dejar al negocio sin punto de venta. El agente solo **lee** de Eleventa. La escritura de vuelta a Eleventa (descontar ventas online del stock físico) se maneja de forma controlada (ver sección F).

---

## B. Las Dos Direcciones de Sincronización

### Dirección 1: Eleventa → Cloud (PUSH de stock)
El agente lee el stock físico de Eleventa y lo empuja a Supabase. Así la web siempre sabe cuánto hay realmente.

### Dirección 2: Cloud → Evento (ventas online a conciliar)
Cuando alguien compra en la web, esa venta reduce el stock en `products`. El agente baja esas ventas para que el cajero del evento sepa que esas unidades ya están apartadas/vendidas y las descuente físicamente.

---

## C. Arquitectura del Agente (offline-first)

```
┌──────────────────────────────────────────────────────────┐
│                  AGENTE (servicio Windows)                 │
│                                                            │
│  ┌────────────┐   lee    ┌──────────────┐                  │
│  │  ELEVENTA  │ ───────► │   LECTOR     │                  │
│  │ PDVDATA.FDB│ (solo    │  Firebird    │                  │
│  └────────────┘ lectura) └──────┬───────┘                  │
│                                 │                          │
│                                 ▼                          │
│                         ┌───────────────┐                  │
│                         │  COLA LOCAL   │  ◄── SQLite en   │
│                         │   (SQLite)    │      disco       │
│                         │ - pendientes  │      (sobrevive  │
│                         │ - idempotency │       reinicios) │
│                         └───────┬───────┘                  │
│                                 │                          │
│           ┌─────────────────────┼──────────────┐           │
│           ▼ (si hay internet)   │              │           │
│   ┌───────────────┐             │              │           │
│   │  SINCRONIZADOR │ ──────────►│              │           │
│   │  (REST a       │            ▼              │           │
│   │   Supabase)    │      ┌──────────────┐     │           │
│   └───────────────┘       │  HEARTBEAT   │     │           │
│                           │  cada 60s    │     │           │
│                           └──────────────┘     │           │
└──────────────────────────────────────────────────────────┘
```

### Componentes internos
1. **Lector Firebird** — abre `PDVDATA.FDB` en modo lectura, extrae productos y existencias.
2. **Cola local SQLite** — `agent_queue.db` en disco. Guarda toda operación pendiente de enviar.
3. **Sincronizador** — cuando hay internet, vacía la cola contra Supabase usando llaves de idempotencia.
4. **Heartbeat** — cada 60s actualiza `sync_config.last_heartbeat` y `agent_status='online'`.
5. **Servicio Windows** — el proceso corre como servicio con autoarranque (NSSM o `pywin32`).

---

## D. Flujo Detallado al Encender la PC

```
1. Windows arranca → el servicio del agente arranca automáticamente.
2. El agente lee su cola local SQLite (agent_queue.db).
   → Si hay operaciones pendientes de un apagón anterior, las marca para reenvío.
3. El agente verifica si hay internet:
   ├── SÍ HAY → envía toda la cola pendiente a Supabase (con idempotency_key).
   │           → marca cada operación como 'synced' al confirmar.
   └── NO HAY → se queda esperando, reintenta cada 60s. La cola permanece intacta.
4. Una vez al día / cada 5 min: lee Eleventa y reconcilia stock.
5. Cada 60s: envía heartbeat.
```

> **Sobrevivir reinicios:** La cola está en SQLite en disco, NO en memoria. Si la PC se apaga con operaciones sin enviar, al encender las encuentra ahí y las reenvía. La `idempotency_key` garantiza que si una operación se envió pero no se confirmó antes del apagón, reenviarla no la duplica.

---

## E. Ciclo de Sincronización de Stock (cada 5 min)

```
PASO 1 — Leer Eleventa
  Conectar a PDVDATA.FDB (lectura) → obtener {clave, existencia, precio} de cada producto.

PASO 2 — Subir a eleventa_catalog
  UPSERT en Supabase tabla eleventa_catalog por 'clave'.
  Actualiza existencia, precio, last_synced_at.

PASO 3 — Calcular stock web con buffer
  Para cada producto vinculado (linked_product_id no nulo):
    buffer = MAX(safety_buffer_min_units, existencia × safety_buffer_percent/100)
    stock_web = MAX(0, existencia_eleventa − ventas_online_no_conciliadas − buffer)
    UPDATE products.stock = stock_web

PASO 4 — Bajar ventas online pendientes
  SELECT de stock_movements WHERE type='online_sale' AND no conciliadas con el evento.
  → Generar reporte/lista para el cajero (o descontar de Eleventa, ver sección F).

PASO 5 — Registrar en sync_log
  Cuántos productos, errores, duración.
```

> **Respetar precio manual:** En el PASO 2, si `products.price_overridden = true`, el agente NO actualiza el precio de ese producto (el admin lo fijó manualmente). El stock SÍ se actualiza siempre.

### Reconciliación de la primera conexión (seed Excel → Eleventa real)
La carga inicial vino del Excel (de hace meses). La primera vez que el agente lee el Eleventa actual, reconcilia por `clave`:
- **Clave existe en ambos:** actualiza existencia y precio a los valores reales.
- **Clave en Eleventa pero no en seed:** crea el registro nuevo en `eleventa_catalog`.
- **Clave en seed pero no en Eleventa:** marca `activo = false` (producto descontinuado; no se borra para conservar historial).

---

## F. El Punto Delicado: Descontar Ventas Online del Stock Físico

Cuando se vende online, esa unidad física sigue en la bodega del evento hasta que se empaca/envía. Hay dos estrategias:

### Estrategia A (RECOMENDADA para empezar): Reporte de apartados
- El agente NO escribe en Eleventa.
- Genera un **reporte de "productos vendidos online"** que el encargado revisa.
- El encargado físicamente separa esas unidades (las aparta para envío).
- El buffer de seguridad absorbe el desfase temporal.
- **Ventaja:** cero riesgo de corromper Eleventa. Simple. Suficiente para 1 caja.

### Estrategia B (avanzada, futura): Escritura controlada a Eleventa
- Solo si Eleventa está **cerrado** (el agente detecta que el archivo no está bloqueado).
- El agente abre el `.FDB`, descuenta el stock vendido online, lo cierra.
- Requiere coordinación: hacerlo de madrugada o cuando el evento no opera.
- **Riesgo:** mayor. Solo implementar si la Estrategia A resulta insuficiente.

> **Para el lanzamiento, usar Estrategia A.** Es robusta y dado que el evento tiene 1 sola caja y buen internet, el buffer de seguridad cubre los casos de borde.

---

## G. Idempotencia (evitar doble descuento)

Cada operación en la cola lleva una `idempotency_key` única, por ejemplo:
```
online_sale:{order_id}:{product_id}
physical_sale:{eleventa_ticket_id}:{product_id}
```
Cuando Supabase recibe la operación, la función `apply_stock_movement` revisa si esa llave ya existe en `stock_movements`. Si existe, responde `already_applied` y no hace nada. Así, reenviar tras un reinicio es seguro.

---

## H. Esquema de la Cola Local (SQLite en la PC)

```sql
CREATE TABLE queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,      -- 'stock_push' | 'physical_sale' | 'heartbeat'
  payload TEXT NOT NULL,             -- JSON
  idempotency_key TEXT UNIQUE,
  status TEXT DEFAULT 'pending',     -- 'pending' | 'synced' | 'failed'
  attempts INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  last_attempt_at TEXT
);
```

---

## I. Manejo de Errores y Reintentos

| Situación | Comportamiento del agente |
|-----------|---------------------------|
| Sin internet | Mantiene cola, reintenta cada 60s, `agent_status='offline'` |
| Eleventa abierto (archivo bloqueado) | Reintenta lectura; si falla, usa último snapshot conocido |
| Supabase responde error 500 | Reintento exponencial (1s, 2s, 4s... máx 5 min) |
| PC se apaga | Cola persiste en SQLite; se reenvía al encender |
| Operación duplicada | Rechazada por `idempotency_key`, sin efecto |
| Conflicto de stock (web vendió de más) | El buffer lo absorbe; si no, se marca para revisión manual |

---

## J. Stack del Agente

- **Lenguaje:** Python 3.11+
- **Firebird:** librería `firebird-driver` o `fdb`
- **Cola local:** `sqlite3` (built-in)
- **HTTP a Supabase:** `httpx` o `requests`
- **Servicio Windows:** `NSSM` (Non-Sucking Service Manager) o `pywin32`
- **Config:** archivo `.env` local con URL de Supabase y service key
- **Logs:** archivo rotativo local + envío a `sync_log` en cloud

> **Nota de seguridad:** El agente usa la **service_role key** de Supabase (no la anon key) porque necesita escribir stock. Esa key debe vivir SOLO en la PC del evento, en un `.env` protegido, nunca en el código del frontend.
