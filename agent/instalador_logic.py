"""Lógica testeable del instalador "de un clic" (ArbolitoSync.exe).

Aquí NO hay GUI ni efectos secundarios: solo funciones puras (o que reciben
dependencias inyectables) para que se puedan probar en Linux con unittest:

  - Detección de la ruta de PDVDATA.FDB en las rutas típicas de Eleventa.
  - Detección de fbclient.dll y de su arquitectura (32/64 bits).
  - Lectura, validación y escritura de config.env.
  - Armado de los comandos de Windows: tarea programada, energía, permisos.

La GUI (Tkinter) y la ejecución real de los comandos viven en arbolito_sync.py.
"""
from __future__ import annotations

import base64
import io
import json
import os
import struct
from typing import Callable, Iterable, Mapping

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
APP_NAME = "ArbolitoSync"
EXE_NAME = "ArbolitoSync.exe"
TASK_NAME = "ArbolitoSyncAgent"  # mismo nombre que instalar_tarea.ps1 (se reemplazan entre sí)
CONFIG_NAME = "config.env"
FDB_FILENAME = "PDVDATA.FDB"

# Rutas típicas donde Eleventa (instalador "AbarrotesPDV") deja la base.
# La primera está confirmada en la PC de la tienda (ver README); el resto son
# variantes comunes (Windows de 32 bits, instalación en la raíz, versiones con
# la carpeta "eleventa"). Si ninguna existe, se hace un barrido corto
# (un nivel) dentro de Program Files / raíz de C: buscando <carpeta>\db\PDVDATA.FDB.
FDB_CANDIDATES_TEMPLATES = (
    r"{pf86}\AbarrotesPDV\db\PDVDATA.FDB",
    r"{pf}\AbarrotesPDV\db\PDVDATA.FDB",
    r"{drive}\AbarrotesPDV\db\PDVDATA.FDB",
    r"{pf86}\eleventa\db\PDVDATA.FDB",
    r"{pf}\eleventa\db\PDVDATA.FDB",
    r"{drive}\eleventa\db\PDVDATA.FDB",
    r"{programdata}\AbarrotesPDV\db\PDVDATA.FDB",
    r"{programdata}\eleventa\db\PDVDATA.FDB",
    r"{public}\Documents\eleventa\db\PDVDATA.FDB",
)

# Dónde suele estar fbclient.dll (la instala Eleventa junto con Firebird 2.5).
FBCLIENT_CANDIDATES_TEMPLATES = (
    r"{pf86}\AbarrotesPDV\fbclient.dll",
    r"{pf86}\AbarrotesPDV\bin\fbclient.dll",
    r"{pf}\AbarrotesPDV\fbclient.dll",
    r"{pf}\AbarrotesPDV\bin\fbclient.dll",
    r"{pf86}\Firebird\Firebird_2_5\bin\fbclient.dll",
    r"{pf}\Firebird\Firebird_2_5\bin\fbclient.dll",
    r"{windir}\SysWOW64\fbclient.dll",
    r"{windir}\System32\fbclient.dll",
)

REQUIRED_KEYS = ("SUPABASE_URL", "SUPABASE_SERVICE_KEY")
# Orden en el que se escriben las llaves conocidas en config.env.
KNOWN_KEYS_ORDER = (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "FDB_DSN",
    "FDB_USER",
    "FDB_PASSWORD",
    "FB_CLIENT_LIBRARY",
    "NTFY_URL",
    "NTFY_TOPIC",
    "NTFY_TOKEN",
)

# SIDs bien conocidos (independientes del idioma de Windows: en español el
# grupo se llama "Administradores", por eso NO se usan nombres).
SID_SYSTEM = "*S-1-5-18"
SID_ADMINISTRATORS = "*S-1-5-32-544"


# ---------------------------------------------------------------------------
# Rutas de Windows
# ---------------------------------------------------------------------------
def windows_dirs(env: Mapping[str, str]) -> dict:
    """Carpetas base a partir de las variables de entorno (con valores por defecto)."""
    drive = env.get("SystemDrive") or "C:"
    return {
        "drive": drive,
        "pf": env.get("ProgramW6432") or env.get("ProgramFiles") or drive + r"\Program Files",
        "pf86": env.get("ProgramFiles(x86)") or drive + r"\Program Files (x86)",
        "programdata": env.get("ProgramData") or drive + r"\ProgramData",
        "public": env.get("PUBLIC") or drive + r"\Users\Public",
        "windir": env.get("SystemRoot") or env.get("windir") or drive + r"\Windows",
    }


def install_dir(env: Mapping[str, str]) -> str:
    r"""%ProgramData%\ArbolitoSync"""
    return windows_dirs(env)["programdata"] + "\\" + APP_NAME


def _expand(templates: Iterable[str], env: Mapping[str, str]) -> list[str]:
    dirs = windows_dirs(env)
    seen, out = set(), []
    for t in templates:
        p = t.format(**dirs)
        if p.lower() not in seen:
            seen.add(p.lower())
            out.append(p)
    return out


def fdb_candidates(env: Mapping[str, str]) -> list[str]:
    return _expand(FDB_CANDIDATES_TEMPLATES, env)


def fbclient_candidates(env: Mapping[str, str]) -> list[str]:
    return _expand(FBCLIENT_CANDIDATES_TEMPLATES, env)


def find_fdb(
    env: Mapping[str, str],
    exists: Callable[[str], bool] = os.path.isfile,
    listdir: Callable[[str], list] = os.listdir,
    join: Callable[..., str] = None,
) -> str | None:
    """Devuelve la primera ruta de PDVDATA.FDB que exista, o None.

    1) Rutas típicas (FDB_CANDIDATES_TEMPLATES).
    2) Barrido de un nivel en Program Files, Program Files (x86) y la raíz de C:
       buscando <carpeta>\\db\\PDVDATA.FDB o <carpeta>\\PDVDATA.FDB.
    `exists`/`listdir`/`join` se inyectan para probar sin Windows.
    """
    join = join or (lambda *parts: "\\".join(parts))
    for path in fdb_candidates(env):
        if exists(path):
            return path
    dirs = windows_dirs(env)
    for base in (dirs["pf86"], dirs["pf"], dirs["drive"] + "\\"):
        try:
            children = sorted(listdir(base))
        except OSError:
            continue
        for child in children:
            root = join(base.rstrip("\\"), child)
            for path in (join(root, "db", FDB_FILENAME), join(root, FDB_FILENAME)):
                if exists(path):
                    return path
    return None


def dsn_from_path(fdb_path: str) -> str:
    """Ruta de archivo -> DSN por el servidor Firebird local ("localhost:<ruta>")."""
    p = (fdb_path or "").strip().strip('"')
    if not p:
        return ""
    if p.lower().startswith("localhost:"):
        return p
    return "localhost:" + p


def path_from_dsn(dsn: str) -> str:
    d = (dsn or "").strip()
    if d.lower().startswith("localhost:"):
        return d[len("localhost:"):]
    return d


# ---------------------------------------------------------------------------
# fbclient.dll: arquitectura
# ---------------------------------------------------------------------------
PE_MACHINES = {0x014C: 32, 0x8664: 64, 0xAA64: 64}


def pe_bits(data: bytes) -> int | None:
    """Bits (32/64) de un ejecutable/DLL PE a partir de sus primeros bytes, o None."""
    if len(data) < 0x40 or data[:2] != b"MZ":
        return None
    (pe_off,) = struct.unpack_from("<I", data, 0x3C)
    if len(data) < pe_off + 6 or data[pe_off:pe_off + 4] != b"PE\0\0":
        return None
    (machine,) = struct.unpack_from("<H", data, pe_off + 4)
    return PE_MACHINES.get(machine)


def pick_fbclient(candidates: Iterable[str], want_bits: int,
                  read_head: Callable[[str], bytes | None]) -> tuple[str | None, list[str]]:
    """Elige la primera fbclient.dll con la arquitectura del .exe.

    Devuelve (ruta_compatible | None, [rutas encontradas pero de otra arquitectura]).
    `read_head(path)` devuelve los primeros ~4 KB del archivo o None si no existe.
    """
    mismatched = []
    for path in candidates:
        head = read_head(path)
        if head is None:
            continue
        bits = pe_bits(head)
        if bits == want_bits:
            return path, mismatched
        mismatched.append(path)
    return None, mismatched


# ---------------------------------------------------------------------------
# config.env
# ---------------------------------------------------------------------------
def parse_env(text: str) -> dict:
    """Parsea texto estilo .env con python-dotenv (igual que lo lee agent.py)."""
    from dotenv import dotenv_values

    return {k: (v or "") for k, v in dotenv_values(stream=io.StringIO(text or "")).items()}


def _quote(value: str) -> str:
    """Comillas simples (literal en python-dotenv, las diagonales de rutas no se
    tocan). Si el valor trae comilla simple, dobles con escapes."""
    if "'" not in value:
        return "'" + value + "'"
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def render_env(values: Mapping[str, str]) -> str:
    """Escribe config.env: llaves conocidas primero, luego el resto (se conservan)."""
    lines = [
        "# config.env de ArbolitoSync - generado con 'ArbolitoSync.exe --configurar'.",
        "# CONTIENE LLAVES SECRETAS: no compartir, no subir a GitHub, no mandar por WhatsApp.",
        "",
    ]
    keys = [k for k in KNOWN_KEYS_ORDER if k in values]
    keys += sorted(k for k in values if k not in KNOWN_KEYS_ORDER)
    for k in keys:
        v = values[k]
        if v is None or str(v).strip() == "":
            continue
        lines.append(f"{k}={_quote(str(v).strip())}")
    return "\n".join(lines) + "\n"


def _jwt_role(token: str) -> str | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    payload = parts[1] + "=" * (-len(parts[1]) % 4)
    try:
        return json.loads(base64.urlsafe_b64decode(payload.encode()).decode("utf-8")).get("role")
    except Exception:  # noqa: BLE001 — no es un JWT legible
        return None


def validate_config(values: Mapping[str, str]) -> list[str]:
    """Lista de problemas (en español). Vacía = config válida para arrancar."""
    problems = []
    for k, v in values.items():
        if "\n" in str(v) or "\r" in str(v):
            problems.append(f"{k} tiene saltos de línea.")

    url = (values.get("SUPABASE_URL") or "").strip()
    if not url:
        problems.append("Falta SUPABASE_URL.")
    elif not url.startswith("https://") or "<" in url:
        problems.append("SUPABASE_URL debe empezar con https:// (p. ej. https://xxxx.supabase.co).")

    key = (values.get("SUPABASE_SERVICE_KEY") or "").strip()
    if not key:
        problems.append("Falta SUPABASE_SERVICE_KEY.")
    elif " " in key or len(key) < 20:
        problems.append("SUPABASE_SERVICE_KEY no parece una llave válida.")
    elif key.startswith("sb_publishable_"):
        problems.append("SUPABASE_SERVICE_KEY es la llave PÚBLICA; se necesita la secreta (service_role / sb_secret_).")
    else:
        role = _jwt_role(key)
        if role is not None and role != "service_role":
            problems.append(f"SUPABASE_SERVICE_KEY es de rol '{role}'; se necesita 'service_role'.")

    dsn = (values.get("FDB_DSN") or "").strip()
    if dsn and not path_from_dsn(dsn).lower().endswith(".fdb"):
        problems.append("FDB_DSN debe apuntar a un archivo .FDB (p. ej. PDVDATA.FDB).")

    ntfy_url = (values.get("NTFY_URL") or "").strip()
    ntfy_topic = (values.get("NTFY_TOPIC") or "").strip()
    if ntfy_topic and "<" in ntfy_topic:
        problems.append("NTFY_TOPIC sigue con el valor de ejemplo.")
    if ntfy_topic and not ntfy_url:
        problems.append("Hay NTFY_TOPIC pero falta NTFY_URL.")
    if ntfy_url and not (ntfy_url.startswith("https://") or ntfy_url.startswith("http://")):
        problems.append("NTFY_URL debe empezar con https://.")
    return problems


def merge_config(existing: Mapping[str, str], form: Mapping[str, str]) -> dict:
    """Combina lo que ya había en config.env con lo capturado en el formulario.

    Un campo vacío en el formulario NO borra un secreto ya guardado (así Hermann
    puede cambiar solo el topic sin volver a pegar la llave)."""
    out = dict(existing)
    for k, v in form.items():
        v = (v or "").strip()
        if v:
            out[k] = v
    return out


# ---------------------------------------------------------------------------
# Comandos de Windows (solo se ARMAN aquí; se ejecutan en arbolito_sync.py)
# ---------------------------------------------------------------------------
def ps_quote(s: str) -> str:
    """Literal de PowerShell entre comillas simples."""
    return "'" + str(s).replace("'", "''") + "'"


def build_task_script(program: str, arguments: str, work_dir: str, task_name: str = TASK_NAME) -> str:
    """Script de PowerShell que registra la tarea programada.

    Mismas reglas que instalar_tarea.ps1: arranca al prender la PC (SYSTEM, sin
    sesión iniciada), se reinicia si truena (cada 1 min, 999 veces), se relanza
    cada 10 min si no está corriendo, sin límite de tiempo, sin cortar en batería.
    """
    return "\n".join([
        "$ErrorActionPreference = 'Stop'",
        f"$TaskName = {ps_quote(task_name)}",
        f"$Action = New-ScheduledTaskAction -Execute {ps_quote(program)} "
        f"-Argument {ps_quote(arguments)} -WorkingDirectory {ps_quote(work_dir)}",
        "$TrigBoot = New-ScheduledTaskTrigger -AtStartup",
        # 9999 días en vez de [TimeSpan]::MaxValue: MaxValue falla en varias
        # versiones de Windows 10 ("valor fuera de intervalo").
        "$TrigMin = New-ScheduledTaskTrigger -Once -At (Get-Date) "
        "-RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 9999)",
        "$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest",
        "$Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) "
        "-ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew "
        "-DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -StartWhenAvailable",
        "if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {",
        "  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue",
        "  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false",
        "}",
        "Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($TrigBoot, $TrigMin) "
        "-Principal $Principal -Settings $Settings "
        "-Description 'Jugueteria El Arbolito - sincronizacion con Eleventa (autoarranque + watchdog)' | Out-Null",
        "Start-ScheduledTask -TaskName $TaskName",
    ])


def build_stop_script(task_name: str = TASK_NAME) -> str:
    """Detiene la tarea si está corriendo (para poder reemplazar el .exe)."""
    return f"Stop-ScheduledTask -TaskName {ps_quote(task_name)} -ErrorAction SilentlyContinue"


def build_uninstall_script(task_name: str = TASK_NAME) -> str:
    return "\n".join([
        f"$TaskName = {ps_quote(task_name)}",
        "if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {",
        "  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue",
        "  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false",
        "}",
    ])


def powershell_argv(script: str) -> list[str]:
    """argv para correr un script sin archivos temporales (-EncodedCommand = UTF-16LE base64)."""
    encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
    return ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-EncodedCommand", encoded]


def decode_powershell_argv(argv: list[str]) -> str:
    """Inverso de powershell_argv (para pruebas y para el log)."""
    return base64.b64decode(argv[-1]).decode("utf-16-le")


def task_action(frozen: bool, executable: str, script_path: str) -> tuple[str, str]:
    """(programa, argumentos) de la tarea: el .exe instalado, o python + script en desarrollo."""
    if frozen:
        return executable, "--agente"
    return executable, f'"{script_path}" --agente'


def power_commands() -> list[list[str]]:
    """Que la PC no se suspenda ni hiberne enchufada (el agente corre 24/7)."""
    return [
        ["powercfg", "/change", "standby-timeout-ac", "0"],
        ["powercfg", "/change", "hibernate-timeout-ac", "0"],
        ["powercfg", "/change", "disk-timeout-ac", "0"],
    ]


def restrict_acl_argv(path: str) -> list[str]:
    """icacls: quita herencia y deja SOLO a SYSTEM y Administradores (control total).

    Así un usuario normal de la PC no puede leer las llaves; el agente (SYSTEM) y
    Hermann (como administrador) sí."""
    return ["icacls", path, "/inheritance:r", "/grant:r",
            f"{SID_SYSTEM}:(F)", f"{SID_ADMINISTRATORS}:(F)"]


def query_task_argv(task_name: str = TASK_NAME) -> list[str]:
    return ["schtasks", "/Query", "/TN", task_name, "/V", "/FO", "LIST"]


# ---------------------------------------------------------------------------
# Decisión del primer arranque (sin GUI): ¿qué le decimos a la tía?
# ---------------------------------------------------------------------------
OUTCOME_OK = "ok"
OUTCOME_FALTA_CONFIG = "falta_config"
OUTCOME_NO_ELEVENTA = "no_eleventa"
OUTCOME_CONFIG_INVALIDA = "config_invalida"


def resolve_config(
    config_text: str | None,
    env: Mapping[str, str],
    exists: Callable[[str], bool] = os.path.isfile,
    listdir: Callable[[str], list] = os.listdir,
    read_head: Callable[[str], bytes | None] = lambda p: None,
    want_bits: int = 64,
) -> tuple[str, dict, bool, str]:
    """Revisa config.env y completa lo que se puede detectar solo.

    Devuelve (outcome, valores, cambio, detalle):
      - outcome: OUTCOME_* (qué mensaje mostrar).
      - valores: config resultante (con FDB_DSN / FB_CLIENT_LIBRARY detectados).
      - cambio: True si hay que reescribir config.env.
      - detalle: texto técnico corto para Hermann (va en letra chica y al log).
    """
    if config_text is None:
        return OUTCOME_FALTA_CONFIG, {}, False, "No existe config.env"
    values = parse_env(config_text)
    changed = False

    missing = [k for k in REQUIRED_KEYS if not (values.get(k) or "").strip()]
    if missing:
        return OUTCOME_FALTA_CONFIG, values, False, "Faltan: " + ", ".join(missing)

    # Ruta de Eleventa: la de config.env si existe; si no, se busca sola.
    dsn = (values.get("FDB_DSN") or "").strip()
    if not dsn or not exists(path_from_dsn(dsn)):
        found = find_fdb(env, exists=exists, listdir=listdir)
        if not found:
            where = path_from_dsn(dsn) if dsn else "rutas típicas"
            return OUTCOME_NO_ELEVENTA, values, False, f"No se encontró {FDB_FILENAME} ({where})"
        new_dsn = dsn_from_path(found)
        if new_dsn != dsn:
            values["FDB_DSN"] = new_dsn
            changed = True

    # fbclient.dll de la misma arquitectura que el .exe (si no la fijó Hermann).
    detail = ""
    if not (values.get("FB_CLIENT_LIBRARY") or "").strip():
        dll, mismatched = pick_fbclient(fbclient_candidates(env), want_bits, read_head)
        if dll:
            values["FB_CLIENT_LIBRARY"] = dll
            changed = True
        elif mismatched:
            detail = (f"Aviso: fbclient.dll encontrada pero no es de {want_bits} bits "
                      f"({mismatched[0]}); compilar el .exe con Python de la otra arquitectura.")

    problems = validate_config(values)
    if problems:
        return OUTCOME_CONFIG_INVALIDA, values, changed, " ".join(problems)
    return OUTCOME_OK, values, changed, detail
