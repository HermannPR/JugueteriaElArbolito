# Agente de Sincronización — Juguetería El Arbolito

Lee el inventario de Eleventa (PDVDATA.FDB) y lo sincroniza con Supabase cada 5 minutos.

## Instalación en la PC de la tienda (Windows)

### 1. Instalar Python 3.11+
Descargar de https://python.org e instalar con la opción "Add to PATH" marcada.

### 2. Copiar este directorio a la PC
Colocar la carpeta `agent/` en, por ejemplo, `C:\ArbolSyncAgent\`.

### 3. Crear el archivo .env
Copiar `.env.example` como `.env` y llenar los valores:
```
SUPABASE_URL=https://nigxlspxlurdxvwnlffu.supabase.co
SUPABASE_SERVICE_KEY=TU_SERVICE_ROLE_KEY_AQUI
FDB_PATH=C:\Archivos de Programa\AbarrotesPDV\db\PDVDATA.FDB
```

> La service_role key se encuentra en el panel de Supabase: Settings → API → service_role.
> **NUNCA compartir esta key. Vive solo en este .env en la PC de la tienda.**

### 4. Instalar dependencias
```cmd
cd C:\ArbolSyncAgent
pip install -r requirements.txt
```

### 5. Probar manualmente
```cmd
python agent.py --once
```
Debe mostrar en consola cuántos productos leyó y si los subió correctamente.

### 6. Instalar como servicio de Windows (arranca automáticamente)
```cmd
# Primero descargar NSSM desde https://nssm.cc/download y agregar al PATH
python agent.py --install
```

Esto crea un servicio llamado `ArbolitoSyncAgent` que arranca con Windows.

Para ver el estado del servicio:
```cmd
nssm status ArbolitoSyncAgent
```

Para detenerlo / iniciarlo:
```cmd
nssm stop ArbolitoSyncAgent
nssm start ArbolitoSyncAgent
```

## Logs
- `agent.log` en el mismo directorio — rotativo, muestra cada ciclo.
- Panel de admin de la tienda web → sección "Sincronización" (próximamente).

## Reglas importantes
- El agente **solo lee** PDVDATA.FDB, nunca escribe.
- Si Eleventa está abierto y no puede leer el archivo, espera al siguiente ciclo.
- La cola SQLite (`agent_queue.db`) guarda operaciones pendientes entre reinicios.
