# Cómo instalar el programa de la tienda

**Juguetería El Arbolito** · Son 5 pasos. Tardas unos 5 minutos.

> Si ves algo raro, **mándale foto a Hermann**. No pasa nada malo.

---

## Paso 1. Guarda el archivo

Hermann te manda un archivo llamado **ArbolitoSync.exe** por **WhatsApp**.

Guárdalo en el **Escritorio** de la computadora de la tienda.

> Si no sabes cómo guardarlo, llama a Hermann y él te dice.

---

## Paso 2. Ábrelo

En el Escritorio, busca el archivo **ArbolitoSync** y dale **doble clic**.

---

## Paso 3. Dale permiso

Pueden salir **una o dos** ventanas azules:

| Si dice… | Tú haces… |
|---|---|
| «Windows protegió su PC» | Clic en **Más información** y luego en **Ejecutar de todas formas** |
| «¿Quieres permitir que esta aplicación haga cambios?» | Clic en **Sí** |

---

## Paso 4. Espera el aviso

Sale una ventana con letras grandes. Espera un momento.

| Si dice… | Tú haces… |
|---|---|
| **Listo, ya está funcionando.** | Clic en **Cerrar**. ¡Ya terminaste! |
| **Falta la configuración. Avísale a Hermann.** | Clic en **Cerrar** y avísale a Hermann. Él lo arregla. |
| Cualquier otra cosa | Tómale **foto** a la pantalla y mándasela a Hermann. |

---

## Paso 5. Ya no tienes que hacer nada

- El programa **arranca solo** cada vez que prendes la computadora.
- Usa Eleventa **como siempre**.
- **No borres** el archivo del Escritorio (si lo borras, no pasa nada, pero mejor déjalo).

> Si ves algo raro, **mándale foto a Hermann**.

---

## Solo para Hermann

**1. Compilar** (en tu PC con Windows, Python 3.11+ de 32 bits recomendado):

```
powershell -ExecutionPolicy Bypass -File .\agent\build_exe.ps1
```

Sale `agent\dist\ArbolitoSync.exe` y su SHA256. Pásalo por WhatsApp o USB.
Nunca lo subas a GitHub ni a un enlace público. El .exe **no** lleva llaves.

**2. Configurar** (en remoto, en la PC de la tienda, una sola vez):

```
ArbolitoSync.exe --configurar
```

Llenar `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NTFY_URL`, `NTFY_TOPIC`,
`NTFY_TOKEN` y la ruta de `PDVDATA.FDB` → **Guardar e instalar**. Se guarda en
`C:\ProgramData\ArbolitoSync\config.env`, legible solo por SYSTEM y Administradores.

**3. Verificar que corre:**

- `ArbolitoSync.exe --estado` → tarea `ArbolitoSyncAgent` en «En ejecución» y últimas líneas de `agent.log`.
- `ArbolitoSync.exe --dry-run` → cuenta de productos leídos de Eleventa (no manda nada).
- Panel web → **Sistema**: heartbeat reciente (menos de 15 min).
