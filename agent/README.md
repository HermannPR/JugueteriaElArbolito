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

## Instalación en la PC de la tienda (Windows)

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
