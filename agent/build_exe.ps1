# =============================================================================
# build_exe.ps1  -  Compila ArbolitoSync.exe (un solo archivo) con PyInstaller.
#
# Se corre en la PC de Hermann (Windows), NO en la tienda ni en CI:
#   powershell -ExecutionPolicy Bypass -File .\agent\build_exe.ps1
#   powershell -ExecutionPolicy Bypass -File .\agent\build_exe.ps1 -Python "C:\Python311-32\python.exe"
#
# Resultado: agent\dist\ArbolitoSync.exe  (se pasa a la tienda por WhatsApp/USB).
# Distribución PRIVADA: no subir el .exe a GitHub, Releases ni enlaces públicos.
#
# Arquitectura: fbclient.dll de Eleventa (Firebird 2.5) casi siempre es de
# 32 bits (se instala en "Program Files (x86)"). Un .exe de 64 bits NO puede
# cargar una DLL de 32 bits, así que por defecto se busca Python de 32 bits
# (py -3-32). Si en la tienda se confirma un fbclient.dll de 64 bits, compilar
# con -Python apuntando a un Python de 64 bits.
# =============================================================================
param(
  [string]$Python = "",
  [switch]$SkipTests
)
$ErrorActionPreference = "Stop"
$AgentDir = $PSScriptRoot
Set-Location $AgentDir

# 0) Nunca empaquetar secretos: el spec no incluye datos, pero avisar si hay
#    archivos con llaves en la carpeta (no deben ni commitearse).
foreach ($f in @(".env", "config.env")) {
  if (Test-Path (Join-Path $AgentDir $f)) {
    Write-Warning "Existe agent\$f con llaves. No se empaqueta, pero NO lo subas a git."
  }
}

# 1) Elegir Python (preferir 32 bits).
if (-not $Python) {
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    try {
      $out = & py -3-32 -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $out) { $Python = "$out".Trim() }
    } catch { }
  }
  if (-not $Python) {
    $Python = (Get-Command python -ErrorAction SilentlyContinue).Source
    Write-Warning "No se encontró Python de 32 bits (py -3-32). Se usa: $Python"
  }
}
if (-not $Python) { throw "No hay Python. Instala Python 3.11+ (32 bits recomendado) de python.org." }
& $Python -c "import sys, struct; print('Python', sys.version.split()[0], struct.calcsize('P')*8, 'bits')"

# 2) Entorno de compilación aislado.
$Venv = Join-Path $AgentDir ".build-venv"
if (-not (Test-Path $Venv)) { & $Python -m venv $Venv }
$VPy = Join-Path $Venv "Scripts\python.exe"
& $VPy -m pip install --upgrade pip | Out-Null
& $VPy -m pip install -r (Join-Path $AgentDir "requirements.txt") "pyinstaller>=6.10,<7"
if ($LASTEXITCODE -ne 0) { throw "Falló pip install" }

# 3) Pruebas antes de compilar.
if (-not $SkipTests) {
  & $VPy -m unittest discover -s (Join-Path $AgentDir "tests")
  if ($LASTEXITCODE -ne 0) { throw "Las pruebas fallaron; no se compila." }
}

# 4) Compilar.
& $VPy -m PyInstaller --noconfirm --clean (Join-Path $AgentDir "ArbolitoSync.spec")
if ($LASTEXITCODE -ne 0) { throw "Falló PyInstaller" }

$Exe = Join-Path $AgentDir "dist\ArbolitoSync.exe"
if (-not (Test-Path $Exe)) { throw "No se generó $Exe" }
$Item = Get-Item $Exe
$Hash = (Get-FileHash $Exe -Algorithm SHA256).Hash
Write-Host ""
Write-Host "Listo: $Exe"
Write-Host ("Tamaño: {0:N1} MB" -f ($Item.Length / 1MB))
Write-Host "SHA256: $Hash   (compáralo en la PC de la tienda con: Get-FileHash .\ArbolitoSync.exe)"
Write-Host "Pásalo a la tienda por WhatsApp o USB. No lo subas a GitHub."
