"""Lector de inventario desde el archivo Firebird de Eleventa (PDVDATA.FDB).

IMPORTANTE: Solo lectura. NUNCA escribir en el .FDB con Eleventa abierto.
"""
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# Query para extraer productos y existencias de Eleventa.
# Ajustar nombres de tabla/columna si difieren en la versión instalada.
QUERY_PRODUCTS = """
SELECT
    p.CLAVE        AS clave,
    p.DESCRIPCION  AS nombre,
    p.PRECIO1      AS precio,
    COALESCE(e.EXISTENCIA, 0) AS existencia
FROM PRODUCTOS p
LEFT JOIN EXISTENCIAS e ON e.IDPRODUCTO = p.ID
WHERE p.ACTIVO = 1
ORDER BY p.CLAVE
"""

# Query alternativa si la tabla se llama diferente en algunas versiones de Eleventa
QUERY_PRODUCTS_ALT = """
SELECT
    p.CLAVE        AS clave,
    p.DESCRIPCION  AS nombre,
    p.PRECIO1      AS precio,
    COALESCE(e.EXISTENCIA, 0) AS existencia
FROM PRODUCTO p
LEFT JOIN EXISTENCIA e ON e.PRODUCTO_ID = p.ID
WHERE p.ACTIVO = 1
ORDER BY p.CLAVE
"""


@dataclass
class EleventaProduct:
    clave: str
    nombre: str
    precio: float
    existencia: float


def read_inventory(fdb_path: str) -> list[EleventaProduct]:
    """Lee el inventario completo desde PDVDATA.FDB.

    Retorna lista vacía si el archivo está bloqueado o hay error.
    """
    path = Path(fdb_path)
    if not path.exists():
        logger.error("Archivo Firebird no encontrado: %s", fdb_path)
        return []

    try:
        import firebird.driver as fdb  # type: ignore
    except ImportError:
        logger.error("firebird-driver no instalado. Ejecuta: pip install firebird-driver")
        return []

    try:
        con = fdb.connect(
            database=str(path),
            user="SYSDBA",
            password="masterkey",
            charset="WIN1252",
        )
    except Exception as e:
        logger.warning("No se pudo conectar al archivo Firebird (¿está Eleventa abierto?): %s", e)
        return []

    try:
        cur = con.cursor()
        try:
            cur.execute(QUERY_PRODUCTS)
        except Exception:
            # Intentar query alternativa si la primera falla
            try:
                cur.execute(QUERY_PRODUCTS_ALT)
            except Exception as e2:
                logger.error("Error al consultar productos en Firebird: %s", e2)
                return []

        products = []
        for row in cur.fetchall():
            try:
                products.append(EleventaProduct(
                    clave=str(row[0]).strip(),
                    nombre=str(row[1]).strip(),
                    precio=float(row[2] or 0),
                    existencia=float(row[3] or 0),
                ))
            except Exception as e:
                logger.warning("Fila inválida ignorada: %s", e)
        logger.info("Leídos %d productos de Eleventa.", len(products))
        return products
    finally:
        try:
            con.close()
        except Exception:
            pass
