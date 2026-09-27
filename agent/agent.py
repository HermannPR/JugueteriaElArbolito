"""
Agente de sincronización Eleventa → Supabase (Juguetería El Arbolito).

Cada ciclo lee el catálogo vigente de Eleventa (solo lectura) y manda la foto
completa a Supabase, que calcula altas, bajas, precios y stock en una sola
transacción (función sync_eleventa_snapshot). Si no hay internet o Eleventa no
responde, simplemente se intenta en el siguiente ciclo: la última foto manda.

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

from firebird_reader import EleventaReadError, read_catalog
from supabase_client import SupabaseClient

AGENT_VERSION = "2.0.0"
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
    products = read_catalog(FDB_DSN, FDB_USER, FDB_PASSWORD, FB_CLIENT_LIBRARY)
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


def sync_once(supa: SupabaseClient) -> bool:
    try:
        products = read_catalog(FDB_DSN, FDB_USER, FDB_PASSWORD, FB_CLIENT_LIBRARY)
    except EleventaReadError as e:
        logger.error("%s", e)
        supa.report_status("offline")
        supa.log_error(str(e))
        return False
    if not products:
        logger.warning("Eleventa devolvió 0 productos; no se sincroniza este ciclo.")
        return False

    try:
        summary = supa.sync_snapshot([p.to_json() for p in products], AGENT_VERSION)
    except Exception as e:  # noqa: BLE001 — sin internet, timeout, etc.
        logger.warning("No se pudo enviar a Supabase (se reintenta el siguiente ciclo): %s", e)
        return False

    logger.info(
        "Sincronizado: %s recibidos, %s nuevos, %s cambios de stock, %s de precio, %s bajas%s.",
        summary.get("received"), summary.get("created"), summary.get("stock_changes"),
        summary.get("price_changes"), summary.get("deactivated"),
        " (bajas omitidas: lectura incompleta)" if summary.get("deactivation_skipped") else "",
    )
    return True


def run(once: bool) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env")
        return 1
    supa = SupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.info("Agente %s iniciado. Intervalo %ds. Eleventa: %s", AGENT_VERSION, SYNC_INTERVAL, FDB_DSN)
    try:
        while True:
            ok = sync_once(supa)
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
