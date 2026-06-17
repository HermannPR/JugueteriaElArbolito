"""
Agente de sincronización Eleventa ↔ Supabase.
Lee PDVDATA.FDB (solo lectura) y empuja stock/precios a la nube.

Uso:
    python agent.py              # corre en primer plano (Ctrl+C para salir)
    python agent.py --once       # una sola sincronización y sale (útil para cron/tarea)
    python agent.py --install    # instala como servicio Windows (requiere NSSM)
"""
import argparse
import logging
import os
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

from firebird_reader import read_inventory
from queue_db import QueueDB
from supabase_client import SupabaseClient

load_dotenv()

# ── Configuración ──────────────────────────────────────────────────────────────
FDB_PATH = os.getenv("FDB_PATH", r"C:\Archivos de Programa\AbarrotesPDV\db\PDVDATA.FDB")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL_SECONDS", "300"))
STOCK_BUFFER_MIN = int(os.getenv("STOCK_BUFFER_MIN", "1"))
STOCK_BUFFER_PERCENT = float(os.getenv("STOCK_BUFFER_PERCENT", "0"))
QUEUE_DB_PATH = os.getenv("QUEUE_DB_PATH", "agent_queue.db")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("agent.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("arbolito.agent")


def calc_buffer(existencia: float) -> int:
    """Calcula el buffer de seguridad para no sobrevender."""
    by_percent = int(existencia * STOCK_BUFFER_PERCENT / 100)
    return max(STOCK_BUFFER_MIN, by_percent)


def sync_cycle(db: QueueDB, supa: SupabaseClient, last_sync_count: int) -> int:
    """
    Un ciclo completo de sincronización.
    Retorna el número de productos procesados.
    """
    start = time.monotonic()
    errors = 0

    logger.info("Iniciando ciclo de sincronización — leyendo Eleventa...")
    products = read_inventory(FDB_PATH)

    if not products:
        logger.warning("Sin productos de Eleventa. ¿Está abierto el programa?")
        return last_sync_count

    # Preparar filas para eleventa_catalog
    catalog_rows = []
    for p in products:
        catalog_rows.append({
            "clave": p.clave,
            "nombre": p.nombre,
            "precio": p.precio,
            "existencia": p.existencia,
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
        })

    # Enviar en lotes de 200
    BATCH = 200
    for i in range(0, len(catalog_rows), BATCH):
        batch = catalog_rows[i:i + BATCH]
        if not supa.upsert_eleventa_catalog(batch):
            errors += len(batch)
            # Encolar para reintento
            for row in batch:
                db.enqueue("stock_push", row, idempotency_key=f"catalog:{row['clave']}")
        else:
            logger.debug("Lote %d enviado (%d registros).", i // BATCH + 1, len(batch))

    # Actualizar stock en products
    stock_errors = 0
    for p in products:
        buffer = calc_buffer(p.existencia)
        stock_web = max(0, int(p.existencia) - buffer)

        if not supa.update_product_stock(p.clave, stock_web):
            stock_errors += 1
        if not supa.update_product_price(p.clave, p.precio):
            stock_errors += 1

    if stock_errors:
        logger.warning("%d errores al actualizar stock/precio en products.", stock_errors)
        errors += stock_errors

    duration = time.monotonic() - start
    supa.insert_sync_log(len(products), errors, duration)
    logger.info(
        "Ciclo completado: %d productos, %d errores, %.1fs.",
        len(products), errors, duration,
    )
    return len(products)


def flush_queue(db: QueueDB, supa: SupabaseClient):
    """Envía las operaciones pendientes de la cola local."""
    pending = db.get_pending()
    if not pending:
        return

    logger.info("Enviando %d operaciones de la cola local...", len(pending))
    for row in pending:
        import json
        payload = json.loads(row["payload"])
        op = row["operation_type"]
        success = False

        if op == "stock_push":
            success = supa.upsert_eleventa_catalog([payload])

        if success:
            db.mark_synced(row["id"])
        else:
            db.increment_attempt(row["id"])
            if row["attempts"] >= 4:
                db.mark_failed(row["id"])


def run(once: bool = False):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env")
        sys.exit(1)

    db = QueueDB(QUEUE_DB_PATH)
    supa = SupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Al iniciar, reencolar los fallos de sesión anterior
    db.reset_failed_to_pending()

    logger.info("Agente El Arbolito iniciado. Intervalo: %ds. FDB: %s", SYNC_INTERVAL, FDB_PATH)

    last_sync_count = 0

    try:
        while True:
            online = supa.is_online()

            if online:
                flush_queue(db, supa)
                last_sync_count = sync_cycle(db, supa, last_sync_count)
                supa.update_heartbeat(db.pending_count(), last_sync_count)
            else:
                logger.warning("Sin conexión a internet. Reintentando en %ds...", SYNC_INTERVAL)
                supa.mark_agent_offline()

            if once:
                break

            time.sleep(SYNC_INTERVAL)

    except KeyboardInterrupt:
        logger.info("Agente detenido por el usuario.")
    finally:
        supa.mark_agent_offline()
        supa.close()


def install_windows_service():
    """Instala el agente como servicio de Windows usando NSSM."""
    import subprocess
    import shutil

    nssm = shutil.which("nssm")
    if not nssm:
        print("NSSM no encontrado. Descárgalo de https://nssm.cc/download y agrégalo al PATH.")
        sys.exit(1)

    python_exe = sys.executable
    script = os.path.abspath(__file__)
    service_name = "ArbolitoSyncAgent"

    subprocess.run([nssm, "install", service_name, python_exe, script], check=True)
    subprocess.run([nssm, "set", service_name, "AppDirectory", os.path.dirname(script)], check=True)
    subprocess.run([nssm, "set", service_name, "DisplayName", "El Arbolito — Agente de Sincronización"], check=True)
    subprocess.run([nssm, "set", service_name, "Description", "Sincroniza inventario Eleventa ↔ Supabase"], check=True)
    subprocess.run([nssm, "set", service_name, "Start", "SERVICE_AUTO_START"], check=True)
    subprocess.run([nssm, "start", service_name], check=True)
    print(f"Servicio '{service_name}' instalado e iniciado.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agente de sincronización El Arbolito")
    parser.add_argument("--once", action="store_true", help="Ejecutar un solo ciclo y salir")
    parser.add_argument("--install", action="store_true", help="Instalar como servicio Windows (requiere NSSM)")
    args = parser.parse_args()

    if args.install:
        install_windows_service()
    else:
        run(once=args.once)
