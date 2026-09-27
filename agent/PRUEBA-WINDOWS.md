# Checklist de prueba en Windows (ArbolitoSync.exe)

Para el agente/persona que lo pruebe en la PC de Hermann **antes** de mandarlo a
la tienda. Usar datos de **prueba** (no la service key de producción) salvo en el
paso 6 si se quiere probar contra el proyecto real. PowerShell **como
Administrador** salvo donde se indique. Marcar cada casilla y anotar lo raro.

Datos de prueba sugeridos:
- `SUPABASE_URL=https://prueba.supabase.co`
- `SUPABASE_SERVICE_KEY=sb_secret_PRUEBA_0000000000000000000000`
- `NTFY_URL=https://ntfy.sh`, `NTFY_TOPIC=arbolito-prueba-<algo-al-azar>`, `NTFY_TOKEN` vacío
- Ruta FDB: una copia de `PDVDATA.FDB` si la hay; si no, cualquier archivo
  `C:\Temp\PDVDATA.FDB` (vacío) para probar la detección.

## 0. Preparación
- [ ] `git status` limpio en la rama `claude/canal-humanos-review-47kq7c`.
- [ ] No existe `C:\ProgramData\ArbolitoSync\` (si existe, renombrarla a `...-respaldo`).
- [ ] `schtasks /Query /TN ArbolitoSyncAgent` → "no existe" (si existe, anotar y quitarla con `--desinstalar` al final).

## 1. Compilar
- [ ] `powershell -ExecutionPolicy Bypass -File .\agent\build_exe.ps1`
- [ ] Imprime "Python 3.x.y 32 bits" (o el aviso de que no hay 32 bits; anotarlo).
- [ ] Las pruebas unitarias pasan (`OK`) antes de PyInstaller.
- [ ] Existe `agent\dist\ArbolitoSync.exe` (≈ 10–20 MB) y se imprime su SHA256.
- [ ] El .exe no contiene llaves: `Select-String -Path agent\dist\ArbolitoSync.exe -Pattern "sb_secret_","service_role" -SimpleMatch` no encuentra nada (puede tardar).
- [ ] `git status` sigue sin `dist/`, `build/`, `.build-venv/` (están en `.gitignore`).

## 2. Correr SIN configuración (debe salir el aviso)
- [ ] Copiar `ArbolitoSync.exe` al Escritorio y darle **doble clic** (como usuario normal, sin PowerShell).
- [ ] Sale SmartScreen/UAC → "Sí". (Anotar si pidió "Ejecutar de todas formas".)
- [ ] Ventana grande: **"Falta la configuración. Avísale a Hermann."** con botón **Cerrar**.
- [ ] Existe `C:\ProgramData\ArbolitoSync\ArbolitoSync.exe` (se copió solo).
- [ ] `C:\ProgramData\ArbolitoSync\instalador.log` dice `falta_config No existe config.env`.
- [ ] **No** se registró tarea: `schtasks /Query /TN ArbolitoSyncAgent` → no existe.

## 3. `--configurar` con datos de prueba
- [ ] `& "$env:USERPROFILE\Desktop\ArbolitoSync.exe" --configurar` → formulario.
- [ ] Probar validación: dejar `SUPABASE_URL` en `http://...` → error "debe empezar con https://". Poner una llave `sb_publishable_...` → error "llave PÚBLICA".
- [ ] Llenar los datos de prueba y **Guardar** (no instalar aún) → "Guardado en C:\ProgramData\ArbolitoSync\config.env".
- [ ] Permisos: `icacls C:\ProgramData\ArbolitoSync\config.env` muestra **solo** `NT AUTHORITY\SYSTEM:(F)` y `BUILTIN\Administradores:(F)` (o `Administrators`), sin `Usuarios`/`Users`.
- [ ] Como usuario normal (PowerShell SIN admin): `Get-Content C:\ProgramData\ArbolitoSync\config.env` → acceso denegado.
- [ ] Reabrir `--configurar`: dice "Ya hay una SUPABASE_SERVICE_KEY guardada"; cambiar solo `NTFY_TOPIC`, dejar la llave vacía, Guardar → la llave se conserva (verificar como admin con `Get-Content`).

## 4. Correr CON configuración
- [ ] Doble clic en el `.exe` del Escritorio.
- [ ] Ventana grande verde: **"Listo, ya está funcionando."**
- [ ] Si la ruta FDB guardada no existía y hay Eleventa instalado, `config.env` ahora trae `FDB_DSN='localhost:...PDVDATA.FDB'` detectado (ver `instalador.log`).
- [ ] Sin Eleventa ni FDB válida → debe salir "No encontré Eleventa en esta computadora. Avísale a Hermann." (probar renombrando temporalmente el FDB de prueba).
- [ ] Repetir el doble clic una segunda vez → vuelve a decir "Listo" (reinstalación idempotente, reemplaza el .exe aunque la tarea esté corriendo).

## 5. Verificar tarea programada y logs
- [ ] `schtasks /Query /TN ArbolitoSyncAgent /V /FO LIST`: "Ejecutar como usuario: SYSTEM", tarea a `C:\ProgramData\ArbolitoSync\ArbolitoSync.exe --agente`.
- [ ] `Get-ScheduledTask ArbolitoSyncAgent | Select State` → `Running`.
- [ ] `(Get-ScheduledTask ArbolitoSyncAgent).Triggers` → uno "AtStartup" y uno con repetición cada 10 min.
- [ ] `(Get-ScheduledTask ArbolitoSyncAgent).Settings.RestartCount` → 999.
- [ ] `C:\ProgramData\ArbolitoSync\agent.log` existe y crece; con datos de prueba debe mostrar "Agente 2.1.0 iniciado" y errores de conexión (esperado) sin que el proceso muera.
- [ ] Con 2 fallos seguidos llega la alerta al topic ntfy de prueba (`[sync-arbolito -> hermann] bloqueo: ...`) — abrir `https://ntfy.sh/<topic>` en el navegador.
- [ ] `powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE` → índice AC `0x00000000`.
- [ ] Matar el proceso (`Stop-Process -Name ArbolitoSync -Force`) → en ≤ 1–10 min vuelve a `Running`.
- [ ] Reiniciar la PC → sin iniciar sesión esperar 2 min, luego verificar `Running` y líneas nuevas en `agent.log`.
- [ ] `ArbolitoSync.exe --estado` → ventana con la tarea y las últimas líneas de los logs.
- [ ] Si hay copia de `PDVDATA.FDB` y Firebird 2.5: `ArbolitoSync.exe --dry-run` → ventana con "Productos vigentes en Eleventa: N"; si falla por `fbclient.dll`, anotar el mensaje y la arquitectura (ver README, sección fbclient).

## 6. (Opcional) Contra el proyecto real
- [ ] `--configurar` con las llaves reales → "Guardar e instalar" → panel web **Sistema** muestra heartbeat reciente.

## 7. Desinstalar
- [ ] Desde el `.exe` del Escritorio: `ArbolitoSync.exe --desinstalar` → "¿Quitar la tarea?" Sí → "¿Borrar también C:\ProgramData\ArbolitoSync?" Sí.
- [ ] `schtasks /Query /TN ArbolitoSyncAgent` → no existe.
- [ ] `Test-Path C:\ProgramData\ArbolitoSync` → `False` (si se desinstaló desde la copia de ProgramData, esperar ~5 s).
- [ ] Restaurar la carpeta `...-respaldo` si se renombró en el paso 0.

## Reportar
Resultado por sección (OK / falla + foto o texto), versión de Windows, arquitectura
de Python usada, contenido relevante de `instalador.log` y `agent.log` (**sin**
copiar llaves).
