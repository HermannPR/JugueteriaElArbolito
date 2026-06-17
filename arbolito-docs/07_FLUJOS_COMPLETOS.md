# 07 — Flujos Completos del Sistema

Diagramas paso a paso de todos los procesos clave.

---

## Flujo 1 — Compra Online (con tarjeta)

```
Cliente navega catálogo
   │
   ▼
Agrega productos al carrito  ──► se valida stock disponible (con buffer)
   │
   ▼
Va a checkout → ingresa datos y dirección
   │
   ▼
Elige pagar con tarjeta → backend crea preferencia en Mercado Pago
   │
   ▼
Redirige a Mercado Pago → cliente paga
   │
   ▼
MP confirma pago vía WEBHOOK
   │
   ▼
Backend: ┌─ crea/actualiza orden (payment_status='paid')
         ├─ inserta order_items
         └─ apply_stock_movement(online_sale) por cada ítem
              (idempotency_key = order_id:product_id)
   │
   ▼
products.stock se reduce → la web muestra menos disponible
   │
   ▼
Email de confirmación al cliente
   │
   ▼
El agente (próximo ciclo) detecta la venta online
   │
   ▼
Genera reporte de "apartar para envío" para el evento
```

---

## Flujo 2 — Compra Online con OXXO (pago diferido)

```
Cliente elige OXXO en checkout
   │
   ▼
MP genera voucher con referencia → orden queda 'pending'
   │
   ▼
Stock se RESERVA (no se descuenta definitivo) con caducidad 3 días
   │
   ├─── Cliente paga en OXXO dentro del plazo
   │       │
   │       ▼
   │    MP envía webhook 'paid' → stock se descuenta definitivo
   │       │
   │       ▼
   │    Se procesa como venta normal
   │
   └─── Cliente NO paga en 3 días
           │
           ▼
        MP marca expirado → se libera el stock reservado
```

---

## Flujo 3 — Venta Física en el Evento (Eleventa)

```
Cajero registra venta en Eleventa (como siempre)
   │
   ▼
Eleventa descuenta stock en su archivo Firebird local
   │
   ▼
El agente (cada 5 min) lee Eleventa
   │
   ▼
Detecta que la existencia bajó
   │
   ▼
┌─ HAY INTERNET ──► empuja nuevo stock a Supabase
│                   apply_stock_movement(physical_sale)
│                   → la web actualiza disponibilidad
│
└─ NO HAY INTERNET ─► guarda el cambio en cola SQLite local
                      → cuando vuelve internet, lo envía
                      → idempotency_key evita duplicados
```

---

## Flujo 4 — Sincronización al Encender la PC del Evento

```
Se enciende la PC
   │
   ▼
Windows arranca el servicio del agente (autoarranque)
   │
   ▼
Agente lee su cola SQLite local
   │
   ├─ ¿Hay operaciones pendientes de un apagón anterior?
   │     │
   │     ▼
   │  Sí → las marca para reenvío
   │
   ▼
¿Hay internet?
   │
   ├─ SÍ ─► vacía la cola contra Supabase (con idempotency)
   │        → marca cada operación como 'synced'
   │        → actualiza heartbeat (agent_status='online')
   │
   └─ NO ─► espera, reintenta cada 60s, cola intacta
   │
   ▼
Inicia ciclo normal de sync cada 5 min
```

---

## Flujo 5 — Resolución de Imagen de Producto (Admin)

```
Admin entra a /admin/imagenes
   │
   ▼
Ve cola de productos sin imagen (ordenada por más vendidos)
   │
   ▼
Para el producto actual, ve 3-5 sugerencias automáticas
   │
   ├─ Aprueba una sugerencia (1 clic)
   │     │
   │     ▼
   │  Sistema descarga imagen → convierte a WebP →
   │  genera thumb/medium/large → guarda en Storage →
   │  asigna URL al producto → marca como resuelto
   │
   ├─ Pega URL externa → mismo proceso de descarga/cache
   │
   ├─ Sube archivo propio → mismo proceso
   │
   └─ Salta → pasa al siguiente, queda pendiente
   │
   ▼
Pasa automáticamente al siguiente producto
```

---

## Flujo 6 — Reabasto de Mercancía (Admin)

```
Llega mercancía nueva al negocio
   │
   ▼
Opción A: Se captura en Eleventa
   │         → el agente la sincroniza al cloud automáticamente
   │
Opción B: Admin la registra en /admin/inventario
   │         → apply_stock_movement(restock)
   │         → queda registrada en stock_movements
   ▼
El stock disponible en la web sube
```

---

## Flujo 7 — Conciliación de Inventario (control)

```
Periódicamente (diario / fin de evento):
   │
   ▼
Comparar: existencia_eleventa  vs  stock_calculado_cloud
   │
   ├─ Coinciden → todo bien
   │
   └─ Discrepancia → se genera alerta en /admin/sincronizacion
        │
        ▼
     Admin revisa stock_movements para entender el desfase
        │
        ▼
     Ajuste manual si necesario (apply_stock_movement, manual_adjustment)
```

---

## Resumen de Estados de una Orden

```
pending ──► processing ──► shipped ──► delivered
   │
   └──► cancelled (en cualquier punto antes de delivered)

payment_status:  pending ──► paid ──► (refunded)
                    │
                    └──► failed
```
