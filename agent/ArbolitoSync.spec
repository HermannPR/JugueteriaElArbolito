# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec de ArbolitoSync.exe (un solo archivo, sin consola, pide
# permisos de administrador al abrir). Se usa desde build_exe.ps1:
#   pyinstaller --noconfirm --clean ArbolitoSync.spec
#
# IMPORTANTE (secretos): este spec NO incluye .env ni config.env. Las llaves
# viven solo en %ProgramData%\ArbolitoSync\config.env en la PC de la tienda.
#
# fbclient.dll NO se empaqueta: la instala Eleventa (Firebird 2.5) y el .exe la
# detecta sola (ver instalador_logic.FBCLIENT_CANDIDATES_TEMPLATES). Debe ser de
# la MISMA arquitectura que el Python con el que se compila (por eso
# build_exe.ps1 prefiere Python de 32 bits).
import os

here = os.path.abspath(SPECPATH)

a = Analysis(
    [os.path.join(here, "arbolito_sync.py")],
    pathex=[here],
    binaries=[],
    datas=[],
    hiddenimports=[
        # agent se importa dentro de una función (después de fijar ARBOLITO_DATA_DIR)
        "agent", "firebird_reader", "supabase_client", "notifier", "alert_state", "retry",
        "instalador_logic", "fdb", "httpx", "dotenv",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=["tests"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="ArbolitoSync",
    debug=False,
    strip=False,
    upx=False,          # UPX dispara falsos positivos de antivirus
    console=False,      # sin ventana negra: la tía solo ve las ventanas grandes
    uac_admin=True,     # necesario para registrar la tarea como SYSTEM y powercfg
    runtime_tmpdir=None,
)
