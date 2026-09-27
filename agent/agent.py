"""
Agente de sincronización Eleventa → Supabase (Juguetería El Arbolito).

Cada ciclo lee el catálogo vigente de Eleventa (solo lectura) y manda la foto
completa a Supabase, que calcula altas, bajas, precios y stock en una sola
transacción (función sync_eleventa_snapshot). Si no hay internet o Eleventa no
responde, simplemente se intenta en el siguiente ciclo: la última foto manda.

Robustez (para que "no falle" y, cuando falle, "nos notifique"):
  - Timeout de conexión y de consulta a Firebird (evita cuelgues si Eleventa
    dejó el archivo bloqueado).
  - Reintentos con backoff en errores transitorios (lectura Firebird y red a
    Supabase). El envío es idempotente, así que reintentar no duplica.
  - El bucle NUNCA muere por una excepción: captura, registra (local + sync_log
    remoto) y sigue al siguiente ciclo.
  - Alertas ntfy al entrar en estado "caído" (N fallos seguidos o error crítico)
    y una vez al "recuperarse". Sin spam por ciclo.

Uso:
    python agent.py --dry-run   # solo lee Eleventa y muestra un resumen (no manda nada)
    python agent.py --once      # un ciclo real y sale
    python agent.py             # ciclo continuo (lo que corre el servicio)
    python agent.py --install   # instala el servicio de Windows (requiere NSSM)
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from collections import Counter
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv

from alert_state import AlertEvent, AlertStateMachine
from firebird_reader import EleventaReadError, read_catalog
from notifier import Notifier
from retry import retry_call
from supabase_client import SupabaseClient

AGENT_VERSION = "2.1.0"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
# Por el servidor Firebird de Eleventa (no abrir el archivo directo):
FDB_DSN = os.getenv("FDB_DSN", r"localhost:C:\Program Files (x86)\AbarrotesPDV\db\PDVDATA.FDB")
FDB_USER = os.getenv("FDB_USER", "SYSDBA")
FDB_PASSWORD = os.getenv("FDB_PASSWORD", "masterkey")
FB_CLIENT_LIBRARY = os.getenv("FB_CLIENT_LIBRARY") or None  # p. ej. C:\...\fbclient.dll si no la encuentra
SYNC_INTERVAL = max(60, int(os.getenv("SYNC_INTERVAL_SECONDS", "300")))

# Timeouts de Firebird (segundos).
FDB_CONNECT_TIMEOUT = float(os.getenv("FDB_CONNECT_TIMEOUT_SECONDS", "15"))
FDB_QUERY_TIMEOUT = float(os.getenv("FDB_QUERY_TIMEOUT_SECONDS", "60"))

# Reintentos con backoff ante errores transitorios.
RETRY_ATTEMPTS = max(1, int(os.getenv("RETRY_ATTEMPTS", "3")))
RETRY_BASE_DELAY = float(os.getenv("RETRY_BASE_DELAY_SECONDS", "2"))
RETRY_MAX_DELAY = float(os.getenv("RETRY_MAX_DELAY_SECONDS", "60"))

# Alertas: cuántos ciclos fallidos seguidos antes de avisar "caído".
ALERT_FAIL_THRESHOLD = max(1, int(os.getenv("ALERT_FAIL_THRESHOLD", "2")))

# ntfy (canal de Hivemind). Sin secretos en el repo: se llenan en el .env local.
NTFY_URL = os.getenv("NTFY_URL", "")
NTFY_TOPIC = os.getenv("NTFY_TOPIC", "")
NTFY_TOKEN = os.getenv("NTFY_TOKEN", "")

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        RotatingFileHandler(os.path.join(BASE_DIR, "agent.log"), maxBytes=2_000_000, backupCount=3, encoding="utf-8"),
    ],
)
logger = logging.getLogger("arbolito.agent")


def dry_run() -> int:
    products = read_catalog(
        FDB_DSN, FDB_USER, FDB_PASSWORD, FB_CLIENT_LIBRARY,
        connect_timeout=FDB_CONNECT_TIMEOUT, query_timeout=FDB_QUERY_TIMEOUT,
    )
    tracked = [p for p in products if p.existencia is not None]
    print(f"Productos vigentes en Eleventa: {len(products)}")
    print(f"Con inventario controlado:      {len(tracked)}  (el resto: stock web manual)")
    print(f"Con existencia > 0:             {sum(1 for p in tracked if p.existencia > 0)}")
    print(f"Sin precio:                     {sum(1 for p in products if not p.precio)}")
    print("Departamentos principales:")
    for dept, n in Counter(p.departamento or '(sin departamento)' for p in products).most_common(8):
        print(f"  {n:5d}  {dept}")
    print("\nNo se mandó nada a Supabase (modo --dry-run).")
    return 0


def _read_catalog_with_retry():
    """Lee Eleventa reintentando errores transitorios (bloqueo/timeout puntual)."""
    return retry_call(
        lambda: read_catalog(
            FDB_DSN, FDB_USER, FDB_PASSWORD, FB_CLIENT_LIBRARY,
            connect_timeout=FDB_CONNECT_TIMEOUT, query_timeout=FDB_QUERY_TIMEOUT,
        ),
        attempts=RETRY_ATTEMPTS,
        base_delay=RETRY_BASE_DELAY,
        max_delay=RETRY_MAX_DELAY,
        retry_on=(EleventaReadError,),
    )


def _send_with_retry(supa: SupabaseClient, rows: list[dict]):
    """Envía la foto a Supabase reintentando errores de red (idempotente)."""
    return retry_call(
        lambda: supa.sync_snapshot(rows, AGENT_VERSION),
        attempts=RETRY_ATTEMPTS,
        base_delay=RETRY_BASE_DELAY,
        max_delay=RETRY_MAX_DELAY,
        retry_on=(Exception,),
    )


def _handle_failure(supa: SupabaseClient, notifier: Notifier, alerts: AlertStateMachine, detail: str) -> None:
    """Registra un fallo (local + sync_log remoto), marca offline y notifica si toca."""
    logger.error("Ciclo con fallo: %s", detail)
    # Registrar SIEMPRE en sync_log remoto (antes esto solo iba al log local).
    supa.log_error(detail)
    supa.report_status("offline")
    if alerts.record_failure() == AlertEvent.CAIDO:
        notifier.notify(AlertEvent.CAIDO, detail)


def _handle_success(supa: SupabaseClient, notifier: Notifier, alerts: AlertStateMachine, detail: str) -> None:
    """Registra éxito y notifica recuperación si venía de estar caído."""
    if alerts.record_success() == AlertEvent.RECUPERADO:
        notifier.notify(AlertEvent.RECUPERADO, detail or "el sync volvió a completar un ciclo")


def sync_once(supa: SupabaseClient, notifier: Notifier, alerts: AlertStateMachine) -> bool:
    """Un ciclo completo. Devuelve True si se sincronizó. Nunca lanza."""
    # 1) Leer Eleventa (con timeout + reintentos).
    try:
        products = _read_catalog_with_retry()
    except EleventaReadError as e:
        _handle_failure(supa, notifier, alerts, f"lectura Firebird: {e}")
        return False
    except Exception as e:  # noqa: BLE001 — cualquier otra cosa inesperada al leer
        _handle_failure(supa, notifier, alerts, f"error inesperado al leer Eleventa: {e}")
        return False

    if not products:
        _handle_failure(supa, notifier, alerts, "Eleventa devolvió 0 productos; no se sincroniza este ciclo.")
        return False

    # 2) Enviar a Supabase (con reintentos; idempotente).
    try:
        summary = _send_with_retry(supa, [p.to_json() for p in products])
    except Exception as e:  # noqa: BLE001 — sin internet, timeout, 5xx, etc.
        _handle_failure(supa, notifier, alerts, f"envío a Supabase: {e}")
        return False

    logger.info(
        "Sincronizado: %s recibidos, %s nuevos, %s cambios de stock, %s de precio, %s bajas%s.",
        summary.get("received"), summary.get("created"), summary.get("stock_changes"),
        summary.get("price_changes"), summary.get("deactivated"),
        " (bajas omitidas: lectura incompleta)" if summary.get("deactivation_skipped") else "",
    )
    _handle_success(supa, notifier, alerts, f"{summary.get('received')} productos sincronizados")
    return True


def run(once: bool) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env")
        return 1
    supa = SupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    notifier = Notifier(NTFY_URL, NTFY_TOPIC, NTFY_TOKEN)
    alerts = AlertStateMachine(fail_threshold=ALERT_FAIL_THRESHOLD)
    logger.info(
        "Agente %s iniciado. Intervalo %ds. Umbral de alerta %d fallos. Eleventa: %s",
        AGENT_VERSION, SYNC_INTERVAL, ALERT_FAIL_THRESHOLD, FDB_DSN,
    )
    try:
        while True:
            # El bucle NUNCA debe morir por una excepción: aquí está el cinturón
            # de seguridad final por si algo escapó de sync_once.
            try:
                ok = sync_once(supa, notifier, alerts)
            except Exception as e:  # noqa: BLE001 — el ciclo siguiente vuelve a intentar
                logger.exception("Excepción no controlada en el ciclo; se continúa.")
                try:
                    _handle_failure(supa, notifier, alerts, f"excepción no controlada: {e}")
                except Exception:  # noqa: BLE001 — ni el manejo de error debe tumbar el bucle
                    logger.exception("Falló también el manejo del error; se continúa.")
                ok = False
            if once:
                return 0 if ok else 2
            time.sleep(SYNC_INTERVAL)
    except KeyboardInterrupt:
        logger.info("Agente detenido.")
        return 0
    finally:
        # Con --once el proceso termina por diseño (lo relanza el Programador de
        # tareas): marcarlo offline taparía el "online" que acaba de dejar el sync.
        if not once:
            supa.report_status("offline")
        notifier.close()
        supa.close()


def install_windows_service() -> int:
    import shutil
    import subprocess

    nssm = shutil.which("nssm")
    if not nssm:
        print("NSSM no encontrado. Descárgalo de https://nssm.cc/download y agrégalo al PATH.")
        return 1
    name = "ArbolitoSyncAgent"
    script = os.path.abspath(__file__)
    for args in (
        ["install", name, sys.executable, script],
        ["set", name, "AppDirectory", BASE_DIR],
        ["set", name, "DisplayName", "El Arbolito - Sincronización con Eleventa"],
        ["set", name, "Start", "SERVICE_AUTO_START"],
        ["set", name, "AppRestartDelay", "30000"],
        ["start", name],
    ):
        subprocess.run([nssm, *args], check=True)
    print(f"Servicio '{name}' instalado e iniciado.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agente de sincronización El Arbolito")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--once", action="store_true", help="Un ciclo y salir")
    group.add_argument("--dry-run", action="store_true", help="Solo leer Eleventa y mostrar resumen")
    group.add_argument("--install", action="store_true", help="Instalar servicio de Windows (NSSM)")
    args = parser.parse_args()
    if args.install:
        sys.exit(install_windows_service())
    if args.dry_run:
        try:
            sys.exit(dry_run())
        except EleventaReadError as e:
            print(f"ERROR: {e}")
            sys.exit(1)
    sys.exit(run(once=args.once))
