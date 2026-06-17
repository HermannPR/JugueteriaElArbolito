#!/usr/bin/env python3
"""
FASE 0 — Importación de inventario Eleventa → Supabase
Juguetería El Arbolito

Limpia el Excel, mapea departamentos a categorías/subcategorías existentes,
y prepara los registros para eleventa_catalog y products.

Uso:
  python import_inventario.py --dry-run     # solo muestra resultados, no escribe
  python import_inventario.py --execute     # escribe a Supabase (requiere env vars)
"""

import pandas as pd
import unicodedata
import re
import argparse
import json
import os

EXCEL_PATH = "inventario_21-01-26_excel.xlsx"

# ----------------------------------------------------------------------------
# Slugs de categorías/subcategorías EXISTENTES en Supabase (no modificar)
# ----------------------------------------------------------------------------
CAT = {
    "didacticos": "didacticos",
    "munecas": "munecas-y-bebes",
    "deportes": "deportes",
    "dinosaurios": "dinosaurios",
    "libros": "libros",
    "coleccionables": "coleccionables",
    "casitas": "casitas-y-juegos-de-jardin",
    "mi_alegria": "mi-alegria",
}

def norm(s):
    """Normaliza: minúsculas, sin acentos, sin espacios extra."""
    if not isinstance(s, str):
        return ""
    s = s.strip().lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s)

# ----------------------------------------------------------------------------
# Mapeo directo departamento -> (categoria_slug, subcategoria_slug | None)
# ----------------------------------------------------------------------------
DEPT_MAP = {
    "munecas": (CAT["munecas"], "munecas"),
    "libros": (CAT["libros"], None),  # subcategoria por keyword
    "deportes": (CAT["deportes"], "deportes-al-aire-libre"),
    "juegos de mesa": (CAT["didacticos"], "juegos-de-mesa"),
    "manualidades": (CAT["didacticos"], "arte-y-manualidades"),
    "rompecabezas": (CAT["didacticos"], "rompecabezas"),
    "musicales": (CAT["didacticos"], "musicales"),
    "peluches": (CAT["munecas"], "peluches"),
    "cocina": (CAT["munecas"], "sets-de-te-y-cocina"),
    "dinosaurios": (CAT["dinosaurios"], None),
    "sensoriales": (CAT["didacticos"], "sensorial"),
    "linea cientifica": (CAT["didacticos"], "ciencia-y-experimentos"),
    "estimulacion tempran": (CAT["didacticos"], "estimulacion-temprana"),
    "artes": (CAT["didacticos"], "arte-y-manualidades"),
    "juegos de construcci": (CAT["didacticos"], "construccion-y-bloques"),
    "montables": (CAT["deportes"], "montables-y-correpasillos"),       # NUEVA
    "triciclos": (CAT["deportes"], "triciclos-y-scooters"),            # NUEVA
    "scooters": (CAT["deportes"], "triciclos-y-scooters"),             # NUEVA
    "carros electricos": (CAT["deportes"], "triciclos-y-scooters"),    # NUEVA
    "juegos al aire libre": (CAT["deportes"], "deportes-al-aire-libre"),
    "casitas": (CAT["casitas"], None),
    "coleccionables": (CAT["coleccionables"], None),
    "newborn": (CAT["munecas"], "bebes"),
    "infant 3m - 1 ano": (CAT["munecas"], "bebes"),
    "todler 1 - 3 anos": (CAT["didacticos"], "estimulacion-temprana"),
    "didacticos": (CAT["didacticos"], None),  # subcategoria por keyword
    # Sin mapeo directo claro -> NULL para revisión manual:
    "ninos 4+": (None, None),
    "ninas": (None, None),
    "ninos 5 - 11 anos": (None, None),
    "preescolar 3 - 5 ano": (None, None),
    "- sin departamento -": (None, None),
    "disfraces": (None, None),
    "tapetes": (None, None),
    "bolsa para regalo": (None, None),
    "mobiliario": (None, None),
}

# ----------------------------------------------------------------------------
# Diccionario de keywords -> (categoria_slug, subcategoria_slug)
# Orden importa: lo más específico primero.
# ----------------------------------------------------------------------------
KEYWORDS = [
    (["rompecabezas", "puzzle"], CAT["didacticos"], "rompecabezas"),
    (["abaco", "numeros", "matematic"], CAT["didacticos"], "matematicas-y-logica"),
    (["bloque", "construccion", "lego", "blocks"], CAT["didacticos"], "construccion-y-bloques"),
    (["pintar", "colorear", "crayon", "foamy", "plastilina", "acuarela", "pincel"], CAT["didacticos"], "arte-y-manualidades"),
    (["tambor", "guitarra", "xilofono", "piano", "musical", "sonaj", "pandero"], CAT["didacticos"], "musicales"),
    (["ciencia", "experimento", "microscopio", "quimica", "telescopio"], CAT["didacticos"], "ciencia-y-experimentos"),
    (["dibucolorea", "mi alegria"], CAT["mi_alegria"], None),
    (["cuento"], CAT["libros"], "cuentos-infantiles"),
    (["colorear", "iluminar"], CAT["libros"], "libros-para-colorear"),
    (["libro"], CAT["libros"], "libros-educativos"),
    (["dinosaurio", "dino", "rex", "raptor", "saurio"], CAT["dinosaurios"], None),
    (["peluche", "plush"], CAT["munecas"], "peluches"),
    (["bambineto", "mordedera", "andadera", "andandin", "correpasillos bebe"], CAT["munecas"], "bebes"),
    (["muneca", "barbie", "doll", "lol "], CAT["munecas"], "munecas"),
    (["carriola", "cuna"], CAT["munecas"], "carriolas-y-cunas"),
    (["cocina", "registradora", "postres", "te set", "boba tea", "charola"], CAT["munecas"], "sets-de-te-y-cocina"),
    (["bebe", "baby"], CAT["munecas"], "bebes"),
    (["montable", "go kart", "jeep", "caballito", "corn popper"], CAT["deportes"], "montables-y-correpasillos"),
    (["triciclo", "bicicleta", "scooter", "patineta"], CAT["deportes"], "triciclos-y-scooters"),
    (["pelota", "balon", "futbol", "basket", "aro hula", "hula", "raqueta"], CAT["deportes"], "deportes-al-aire-libre"),
    (["carrito", "carro", "hot wheels", "truck", "vehiculo", "monster"], CAT["deportes"], "bicicletas-y-vehiculos"),
    # --- Ampliación segunda pasada ---
    (["casa", "casita", "country house"], CAT["casitas"], None),
    (["damas chinas", "domino", "loteria", "serpientes y escaleras", "memorama", "baraja", "adivina quien", "ajedrez"], CAT["didacticos"], "juegos-de-mesa"),
    (["geoplano", "abaco", "balanza", "reloj didactic", "ensarta"], CAT["didacticos"], "matematicas-y-logica"),
    (["cubo magico", "cubo rubik", "balero", "yoyo", "yo-yo", "pinball"], CAT["didacticos"], "motricidad-fina"),
    (["cuerda para saltar", "salta", "brincolin", "tunel"], CAT["deportes"], "deportes-al-aire-libre"),
    (["espada", "escudo", "casco", "pistola", "arco", "dardos", "catana"], CAT["coleccionables"], None),
    (["estuche arte", "set de arte", "fomy", "foamy", "gises", "marcadores"], CAT["didacticos"], "arte-y-manualidades"),
    (["princesa", "princesas", "fashion", "frozen", "minnie", "disney"], CAT["munecas"], "munecas"),
    (["estrellas que brillan", "brillan en la noche", "glow"], CAT["didacticos"], "ciencia-y-experimentos"),
    (["horno", "microondas", "licuadora", "refrigerador"], CAT["munecas"], "sets-de-te-y-cocina"),
]

def infer_by_keyword(nombre):
    n = norm(nombre)
    for kws, cat, sub in KEYWORDS:
        for kw in kws:
            if kw in n:
                return cat, sub
    return None, None

def parse_price(v):
    if pd.isna(v):
        return 0.0
    s = str(v).replace("$", "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0

def classify(row):
    dept = norm(row["Departamento"])
    nombre = row["Producto (Ordenado alfabeticamente y por Dpto.)"]
    cat, sub = DEPT_MAP.get(dept, (None, None))
    method = "dept"
    # Si el departamento no dio categoría, o dio categoría sin subcategoría requerida, intentar keyword
    if cat is None:
        kcat, ksub = infer_by_keyword(nombre)
        if kcat:
            cat, sub, method = kcat, ksub, "keyword"
        else:
            method = "manual_review"
    elif sub is None and cat == CAT["didacticos"]:
        # didacticos/libros sin subcategoria: refinar por keyword
        kcat, ksub = infer_by_keyword(nombre)
        if kcat == cat and ksub:
            sub, method = ksub, "dept+keyword"
    elif sub is None and cat == CAT["libros"]:
        kcat, ksub = infer_by_keyword(nombre)
        if kcat == CAT["libros"] and ksub:
            sub, method = ksub, "dept+keyword"
    return cat, sub, method

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--execute", action="store_true")
    args = ap.parse_args()

    df = pd.read_excel(EXCEL_PATH, sheet_name="Inventario Completo")

    records = []
    stats = {"dept": 0, "keyword": 0, "dept+keyword": 0, "manual_review": 0}
    for _, row in df.iterrows():
        cat, sub, method = classify(row)
        stats[method] += 1
        records.append({
            "clave": str(row["Código"]).strip(),
            "descripcion": str(row["Producto (Ordenado alfabeticamente y por Dpto.)"]).strip(),
            "costo": parse_price(row["P. Costo"]),
            "precio": parse_price(row["P. Venta"]),
            "existencia": int(row["Existencia"]) if not pd.isna(row["Existencia"]) else 0,
            "departamento": str(row["Departamento"]).strip(),
            "category_slug": cat,
            "subcategory_slug": sub,
            "map_method": method,
            "is_approved": False,  # todo producto entra SIN aprobar (decisión confirmada)
        })

    total = len(records)
    print(f"\n{'='*60}")
    print(f"RESULTADO DEL MAPEO ({total} productos)")
    print(f"{'='*60}")
    for k, v in stats.items():
        print(f"  {k:18s}: {v:5d}  ({100*v/total:.1f}%)")
    auto = total - stats["manual_review"]
    print(f"  {'-'*40}")
    print(f"  {'AUTOMÁTICO':18s}: {auto:5d}  ({100*auto/total:.1f}%)")
    print(f"  {'REVISIÓN MANUAL':18s}: {stats['manual_review']:5d}  ({100*stats['manual_review']/total:.1f}%)")

    # Distribución por categoría
    from collections import Counter
    catc = Counter(r["category_slug"] or "SIN_CATEGORIA" for r in records)
    print(f"\n{'='*60}\nDISTRIBUCIÓN POR CATEGORÍA\n{'='*60}")
    for c, n in catc.most_common():
        print(f"  {n:5d}  {c}")

    if args.dry_run or not args.execute:
        # Guardar muestra para revisión
        with open("mapeo_resultado.json", "w") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        print(f"\n✓ Dry-run. Resultados guardados en mapeo_resultado.json")
        print("  Para escribir a Supabase: --execute (con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)")
        return

    # --- Modo execute: aquí iría la escritura a Supabase ---
    # (El agente del IDE completará esta parte con el cliente de Supabase.
    #  Pasos: 1) crear subcategorías nuevas, 2) UPSERT eleventa_catalog por clave,
    #  3) crear products vinculados con category_id/subcategory_id.)
    print("Modo execute: implementar escritura a Supabase (ver doc 02 y 12).")

if __name__ == "__main__":
    main()
