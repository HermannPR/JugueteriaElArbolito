# Agente de sincronización — Juguetería El Arbolito

Lee el catálogo de Eleventa en la PC de la tienda (**solo lectura**) y lo manda a
Supabase cada 5 minutos. Supabase calcula altas, bajas, precios y stock en una
sola transacción (`sync_eleventa_snapshot`, migración 0004).

## Qué sincroniza

| Eleventa (`PRODUCTOS`) | Web |
|---|---|
| `CODIGO` | clave / `eleventa_sku` |
| `DESCRIPCION` | nombre (solo al crear; después lo edita el equipo) |
| `PFINAL` (precio **con IVA**) | precio, salvo que administración lo fije a mano |
| `DINVENTARIO`, solo si `USA_INVENTARIO = 't'` | stock web = existencia − ventas web pagadas aún no capturadas en Eleventa |
| `ELIMINADO_EN` con fecha | el producto se desactiva en la web |
| código nuevo | se crea **sin publicar**; los empleados le ponen foto y categoría |

- Si Eleventa **no lleva inventario** de un producto, su stock web es manual (se ajusta en el panel).
- Una lectura vacía o incompleta **nunca** da de baja productos (queda registrado en `sync_log`).
- No hay cola offline: cada ciclo manda la foto completa, así que si falla internet
  el siguiente ciclo pone todo al día.

## Instalación para la tienda (un clic)

Pensado para que la dueña de la tienda solo dé **doble clic**. Guía impresa para
ella: [`guia-instalacion-tia.pdf`](./guia-instalacion-tia.pdf) (fuente:
`guia-instalacion-tia.md`; se regenera con `python generar_guia_pdf.py`).
Checklist para probarlo en Windows: [`PRUEBA-WINDOWS.md`](./PRUEBA-WINDOWS.md).

**Distribución privada**: el `.exe` se compila en la PC de Hermann y se pasa por
WhatsApp o USB. Nada de GitHub Actions, Releases ni enlaces públicos. El `.exe`
**no lleva llaves**: viven solo en `config.env` de la PC de la tienda.

### 1. Compilar (Hermann, en Windows)
```
powershell -ExecutionPolicy Bypass -File .\agent\build_exe.ps1
```
Crea un venv (`agent\.build-venv`), instala `requirements.txt` + PyInstaller,
corre las pruebas y genera `agent\dist\ArbolitoSync.exe` (onefile, sin consola,
pide administrador) con [`ArbolitoSync.spec`](./ArbolitoSync.spec). Imprime el
SHA256 para comparar en la tienda.

**fbclient.dll (Firebird)**: no se empaqueta. La instala Eleventa (Firebird 2.5) y
el `.exe` la busca sola (carpeta de AbarrotesPDV, `Firebird\Firebird_2_5\bin`,
`SysWOW64`/`System32`) y guarda la ruta en `FB_CLIENT_LIBRARY` si es de la **misma
arquitectura** que el `.exe`. Como Eleventa se instala en `Program Files (x86)`
(32 bits), `build_exe.ps1` usa **Python de 32 bits** (`py -3-32`) por defecto. Si
en `instalador.log` sale "fbclient.dll encontrada pero no es de N bits",
recompilar con la otra arquitectura: `build_exe.ps1 -Python <ruta a python.exe>`.
Si no se encuentra ninguna, `fdb` usa la del registro de Firebird / PATH.

### 2. Primer arranque (la tía: doble clic)
`ArbolitoSync.exe` sin argumentos:
1. Pide permiso de administrador (UAC) y se copia a `%ProgramData%\ArbolitoSync\`.
2. Busca `config.env` ahí. Si falta → **una** ventana: "Falta la configuración.
   Avísale a Hermann." (nunca le pide llaves a ella).
3. Detecta `PDVDATA.FDB` si `config.env` no trae una ruta que exista. Rutas que
   revisa, en orden (`instalador_logic.FDB_CANDIDATES_TEMPLATES`):
   - `C:\Program Files (x86)\AbarrotesPDV\db\PDVDATA.FDB` (confirmada en la tienda)
   - `C:\Program Files\AbarrotesPDV\db\PDVDATA.FDB`, `C:\AbarrotesPDV\db\PDVDATA.FDB`
   - lo mismo con carpeta `eleventa` (Program Files (x86), Program Files, `C:\`)
   - `C:\ProgramData\AbarrotesPDV\db\`, `C:\ProgramData\eleventa\db\`,
     `C:\Users\Public\Documents\eleventa\db\`
   - barrido de un nivel: `<Program Files (x86)|Program Files|C:\>\*\db\PDVDATA.FDB`
     y `...\*\PDVDATA.FDB`.
   Si no la encuentra: "No encontré Eleventa en esta computadora. Avísale a Hermann."
4. Valida la config, registra la tarea programada **ArbolitoSyncAgent** (mismas
   reglas que `instalar_tarea.ps1`: SYSTEM, al arrancar la PC, reinicio cada 1 min
   si truena, relanzamiento cada 10 min; la acción es `ArbolitoSync.exe --agente`),
   ajusta `powercfg` para no suspender/hibernar enchufada, y muestra
   **"Listo, ya está funcionando."** en letra grande.

Volver a dar doble clic es seguro (reinstala y reemplaza el `.exe` detenido).

### 3. Configurar (Hermann, en remoto, una vez)
```
ArbolitoSync.exe --configurar
```
Formulario: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NTFY_URL`, `NTFY_TOPIC`,
`NTFY_TOKEN` y ruta de `PDVDATA.FDB` (prellenada si se detectó). Valida (https,
que la llave no sea la pública/anon, topic no de ejemplo…). Un campo de llave vacío
**conserva** la ya guardada. "Guardar e instalar" hace además el paso 2.

**Permisos de `config.env`**: se crea un temporal vacío, se le aplica
`icacls <archivo> /inheritance:r /grant:r *S-1-5-18:(F) *S-1-5-32-544:(F)` (solo
SYSTEM y Administradores, por SID para que funcione en Windows en español), se
escribe y se renombra encima. Los usuarios normales no pueden leer las llaves.

### Otros modos del `.exe`
| Comando | Qué hace |
|---|---|
| `--estado` | Ventana con la tarea programada y las últimas líneas de `agent.log` / `instalador.log` |
| `--dry-run` | Lee Eleventa y muestra el resumen (también en `dry-run.txt`); no manda nada |
| `--once` | Un ciclo real (resultado en `agent.log`) |
| `--agente` | Bucle continuo (lo que ejecuta la tarea) |
| `--desinstalar` | Quita la tarea; opcionalmente borra `%ProgramData%\ArbolitoSync` |

Archivos en `%ProgramData%\ArbolitoSync\`: `ArbolitoSync.exe`, `config.env`,
`agent.log` (rotativo), `instalador.log`, `dry-run.txt`.

`agent.py` también lee `config.env` (además de `.env`) de la carpeta indicada por
`ARBOLITO_DATA_DIR` (la fija el `.exe`); con `python agent.py` sigue usando su
propia carpeta, así que la instalación manual de abajo no cambia.

## Instalación manual (Python, alternativa)

1. Instalar **Python 3.11+** de python.org con "Add to PATH".
2. Copiar esta carpeta a `C:\ArbolitoSync\`.
3. Copiar `.env.example` como `.env` y llenar:
   - `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` (Supabase → Project Settings → API).
   - `FDB_DSN`: `localhost:` + la ruta real de `PDVDATA.FDB`. Buscarla en la PC
     (suele estar en `C:\Program Files (x86)\AbarrotesPDV\db\`).
   - `FDB_PASSWORD` si la tienda cambió la contraseña de SYSDBA.
4. `pip install -r requirements.txt`
5. **Primero en modo lectura**:
   ```
   python agent.py --dry-run
   ```
   Muestra cuántos productos hay, cuántos llevan inventario y los departamentos.
   No manda nada. Si dice "0 con inventario controlado", avisar: sin eso el stock
   web tiene que llevarse a mano (ver abajo).
6. Un ciclo real: `python agent.py --once`, y revisar el panel → **Sistema**.
7. Servicio de Windows (arranca solo): instalar [NSSM](https://nssm.cc/download) y
   ```
   python agent.py --install
   ```
   Alternativa sin instalar nada extra (Programador de tareas + watchdog):
   ```
   powershell -ExecutionPolicy Bypass -File .\instalar_tarea.ps1
   ```
   (correr como Administrador; ver la sección **Autoarranque y watchdog**).

## Robustez (para que no falle)
- **Timeouts de Firebird**: la conexión y la consulta se cortan si tardan de más
  (`FDB_CONNECT_TIMEOUT_SECONDS`, `FDB_QUERY_TIMEOUT_SECONDS`). Si Eleventa dejó el
  archivo bloqueado, el ciclo no se cuelga: aborta y reintenta.
- **Reintentos con backoff** ante errores transitorios de lectura y de red
  (`RETRY_ATTEMPTS`, `RETRY_BASE_DELAY_SECONDS`, `RETRY_MAX_DELAY_SECONDS`). El
  envío es idempotente (la última foto manda), así que reintentar no duplica.
- **El bucle nunca muere**: cualquier excepción se captura, se registra (local y en
  `sync_log` remoto) y se sigue con el ciclo siguiente.

## Alertas cuando falla (ntfy)
Cuando el agente entra en estado **caído** avisa por [ntfy](https://ntfy.sh) al canal
de Hivemind, y avisa de nuevo **una sola vez** al **recuperarse** (sin spam por ciclo).

- **Disparadores del "caído"**: `ALERT_FAIL_THRESHOLD` ciclos fallidos seguidos
  (por defecto 2), o error crítico de lectura de Firebird, o no poder subir a
  Supabase. Cualquiera de esos, sostenido hasta el umbral, dispara la alerta.
- **Mensaje**: `[sync-arbolito -> hermann] bloqueo: <detalle>` (y
  `... recuperado: <detalle>` al volver).
- **Config** (en `.env`): `NTFY_URL`, `NTFY_TOPIC`, `NTFY_TOKEN` (opcional; si el
  servidor pide auth, va como `Authorization: Bearer <token>`). Si no se configura,
  las alertas quedan deshabilitadas y solo se registran en el log local.

## Detectar "agente sin reportar" (staleness) desde el panel
`agent_status` por sí solo no basta: si la PC se apaga o el proceso muere en seco,
nadie actualiza esa columna y el estado se queda congelado. El panel debe comparar
`sync_config.last_heartbeat` contra `now()`. Regla sugerida: **stale si lleva más de
3× el intervalo de sync** (5 min → 15 min) sin heartbeat. Consultas listas en
[`staleness.sql`](./staleness.sql) (solo lectura; no tocan producción).

## Autoarranque y watchdog (Windows)
Dos opciones (elegir una):
1. **NSSM (servicio)** — `python agent.py --install`. Corre el agente como servicio
   con autoarranque y reinicio (`AppRestartDelay` 30 s).
2. **Programador de tareas** — `instalar_tarea.ps1` (como Administrador). Registra
   una tarea que arranca al prender la PC, se reinicia si truena (cada 1 min) y se
   relanza cada 10 min si no está corriendo. El mismo script ajusta la energía para
   que la PC **no se suspenda ni hiberne** (necesario para correr 24/7).

> No ejecutar estos instaladores en un contenedor/CI: son para la PC de la tienda.

## Para que el stock web sea automático
En Eleventa, en cada producto que se venda en línea, activar **"Usa inventario"**
y capturar su existencia. La copia de la base revisada el 2026-09-25 no tenía
ningún producto con inventario activado.

## Venta web → Eleventa
Cuando un pedido web se paga, alguien lo **captura como venta en Eleventa** y en el
panel → Pedidos pulsa **"Marcar capturado"**. Mientras no se marque, la
sincronización sigue restando esa venta del stock web para no sobrevender.

## Reglas
- El agente jamás escribe en `PDVDATA.FDB`: transacción de solo lectura por el servidor Firebird.
- La `service_role` key vive solo en el `.env` de esta PC.
- Logs: `agent.log` (rotativo) y panel → Sistema.
