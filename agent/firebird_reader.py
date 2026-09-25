"""Lectura del catálogo de Eleventa (Firebird 2.5, PDVDATA.FDB).

SOLO LECTURA: transacción read-only a través del servidor Firebird que ya usa
Eleventa. Nunca se escribe en la base ni se copia el archivo con Eleventa abierto.

Esquema verificado contra una copia real de la base de la tienda:
  PRODUCTOS.CODIGO        clave (código de barras o clave interna)
  PRODUCTOS.DESCRIPCION   nombre
  PRODUCTOS.PFINAL        precio al público CON IVA  (PVENTA es sin IVA)
  PRODUCTOS.PCOSTO        costo
  PRODUCTOS.DINVENTARIO   existencia; solo es real si USA_INVENTARIO = 't'
  PRODUCTOS.ELIMINADO_EN  borrado lógico (los borrados se ignoran)
  DEPARTAMENTOS.NOMBRE    departamento (vía PRODUCTOS.DEPT)
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

logger = logging.getLogger(__name__)

QUERY = """
SELECT p.CODIGO, p.DESCRIPCION, p.PFINAL, p.PCOSTO, p.DINVENTARIO, p.USA_INVENTARIO, d.NOMBRE
FROM PRODUCTOS p
LEFT JOIN DEPARTAMENTOS d ON d.ID = p.DEPT
WHERE p.ELIMINADO_EN IS NULL
"""


@dataclass
class EleventaProduct:
    clave: str
    descripcion: str
    precio: float | None
    costo: float | None
    existencia: float | None  # None = Eleventa no lleva inventario de este producto
    departamento: str | None

    def to_json(self) -> dict:
        return asdict(self)


def row_to_product(row) -> EleventaProduct | None:
    codigo, descripcion, pfinal, pcosto, dinventario, usa_inventario, departamento = row
    clave = (codigo or "").strip()
    if not clave:
        return None
    tracks = str(usa_inventario or "").strip().lower() in ("t", "s", "1", "true")
    return EleventaProduct(
        clave=clave,
        descripcion=(descripcion or "").strip(),
        precio=round(float(pfinal), 2) if pfinal is not None else None,
        costo=round(float(pcosto), 2) if pcosto is not None else None,
        existencia=float(dinventario) if tracks and dinventario is not None else None,
        departamento=(departamento or "").strip() or None,
    )


class EleventaReadError(Exception):
    pass


def read_catalog(dsn: str, user: str, password: str, client_library: str | None = None) -> list[EleventaProduct]:
    """Lee el catálogo vigente. Lanza EleventaReadError si no se pudo leer
    (en ese caso NO se debe mandar nada a la nube)."""
    try:
        import fdb  # type: ignore
    except ImportError as e:
        raise EleventaReadError("Falta la librería 'fdb'. Ejecuta: pip install -r requirements.txt") from e

    try:
        if client_library:
            fdb.load_api(client_library)
        con = fdb.connect(dsn=dsn, user=user, password=password, charset="WIN1252")
    except Exception as e:  # noqa: BLE001 — cualquier fallo de conexión se reporta igual
        raise EleventaReadError(f"No se pudo conectar a Eleventa ({dsn}): {e}") from e

    try:
        tr = con.trans(default_tpb=fdb.ISOLATION_LEVEL_READ_COMMITED_RO)
        cur = tr.cursor()
        cur.execute(QUERY)
        rows = cur.fetchall()
        tr.commit()
    except Exception as e:  # noqa: BLE001
        raise EleventaReadError(f"Error al consultar PRODUCTOS: {e}") from e
    finally:
        try:
            con.close()
        except Exception:  # noqa: BLE001
            pass

    products = [p for p in (row_to_product(r) for r in rows) if p]
    logger.info("Leídos %d productos vigentes de Eleventa (%d con inventario).",
                len(products), sum(p.existencia is not None for p in products))
    return products
