# =============================================================================
# instalar_tarea.ps1  —  Autoarranque + watchdog del agente en Windows
#
# Registra el agente como TAREA PROGRAMADA que:
#   - arranca al prender la PC (aunque nadie inicie sesión),
#   - se ejecuta en bucle continuo (python agent.py, sin --once),
#   - se REINICIA sola si el proceso truena (reintenta cada 1 min, indefinido),
#   - además, por si el bucle interno muriera, un disparador cada 10 min vuelve
#     a lanzar la tarea si no está corriendo.
#
# Alternativa recomendada para producción: NSSM (ver `python agent.py --install`),
# que corre el agente como SERVICIO de Windows con reinicio automático. Este
# script es la opción sin instalar nada extra (usa el Programador de tareas).
#
# Ejecutar UNA vez, en PowerShell COMO ADMINISTRADOR, desde la carpeta del agente:
#   powershell -ExecutionPolicy Bypass -File .\instalar_tarea.ps1
#
# NO ejecutar en este contenedor: es para la PC de la tienda.
# =============================================================================

$ErrorActionPreference = "Stop"

$TaskName  = "ArbolitoSyncAgent"
$AgentDir  = $PSScriptRoot
$AgentPy   = Join-Path $AgentDir "agent.py"

# Ubicar python (preferir el del PATH; ajustar si usan uno específico).
$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) { $Python = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $Python) { throw "No se encontró Python en el PATH. Instálalo de python.org con 'Add to PATH'." }

Write-Host "Python:  $Python"
Write-Host "Agente:  $AgentPy"

# Acción: correr el agente en bucle continuo (sin --once).
$Action = New-ScheduledTaskAction -Execute $Python -Argument "`"$AgentPy`"" -WorkingDirectory $AgentDir

# Disparadores: al arrancar la PC + cada 10 min (por si el proceso murió).
$TrigBoot = New-ScheduledTaskTrigger -AtStartup
$TrigMin  = New-ScheduledTaskTrigger -Once -At (Get-Date) `
              -RepetitionInterval (New-TimeSpan -Minutes 10) `
              -RepetitionDuration ([TimeSpan]::MaxValue)

# Correr como SYSTEM para que arranque sin sesión iniciada.
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Reiniciar si falla; no detener por tiempo; no matar si la PC pasa a batería.
$Settings = New-ScheduledTaskSettingsSet `
              -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
              -ExecutionTimeLimit ([TimeSpan]::Zero) `
              -MultipleInstances IgnoreNew `
              -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
              -StartWhenAvailable

# Si ya existe, recrearla.
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName `
  -Action $Action -Trigger @($TrigBoot, $TrigMin) `
  -Principal $Principal -Settings $Settings `
  -Description "Juguetería El Arbolito - sincronización con Eleventa (autoarranque + watchdog)"

Start-ScheduledTask -TaskName $TaskName
Write-Host "Tarea '$TaskName' registrada e iniciada."

# -----------------------------------------------------------------------------
# Que la PC NO se suspenda (el agente debe correr 24/7).
# -----------------------------------------------------------------------------
Write-Host "Ajustando energía para que la PC no se suspenda ni apague la pantalla..."
powercfg /change standby-timeout-ac 0     # nunca suspender (enchufada)
powercfg /change hibernate-timeout-ac 0   # nunca hibernar (enchufada)
powercfg /change monitor-timeout-ac 10    # apagar solo el monitor a los 10 min (opcional)
powercfg /change disk-timeout-ac 0        # nunca apagar discos
Write-Host "Listo. Revisa el panel -> Sistema o el archivo agent.log para confirmar la sincronización."
