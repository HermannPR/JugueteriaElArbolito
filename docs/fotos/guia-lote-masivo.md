# Guía: clasificación masiva de fotos del catálogo (t42)

Para el proceso con modelo barato. Basada en el lote 1 (`t42-lote-001.csv`, `t42-resumen.md`).
Arbolito revisa una muestra de cada lote.

## Reglas fijas

- **Solo lectura.** No escribir en la base, en `image_url` ni en la tienda. No descargar ni subir imágenes.
- No inventar ligas: si no se abrió la ficha, no hay liga.
- Una fila por producto, aunque el resultado sea "manual".

## Entrada

Filas de `eleventa_catalog` en `supabase/seed_inventario.sql`:
`(clave, clave, descripcion, precio, costo, existencia, departamento, false)`.
Orden: existencia mayor a 0 primero, de más a menos.

## Paso 1: filtro sin buscar (directo a `manual`)

Marcar `manual` **sin buscar** si se cumple cualquiera:

| Regla | Ejemplo del lote 1 |
|---|---|
| Clave empieza con `489` o `697` (importadores con licencia, casi nunca hay ficha oficial) | 4891861247781 JUEGO DE PASTEL FROZEN |
| Clave sin código de barras (no son 8 a 14 dígitos) **y** sin marca de la lista | CORONA DE PRINCESA PARA NINA |
| Clave interna que empieza con `2500` | 2500083745822 PELOTA INFLABLE STITCH |
| Ropa o disfraz con licencia (bata, pijama, vestido): muchos modelos y tallas | BATA DISNEY PRINCESA |
| Surtidos o "variado/variada/individual" de muñecas genéricas | BARBIE FASHION DOLLS (surtido) |

Motivo: escribir la regla aplicada, por ejemplo `"Codigo 489 (importador generico)"`.

## Paso 2: buscar solo marcas fuertes

Buscar **por nombre y marca**, nunca por código de barras (el buscador no los encuentra y devuelve basura).

| Marca (en la descripción) | Dónde buscar primero (fabricante) | Respaldo |
|---|---|---|
| Mi Alegría / MIALEGRIA | mialegria.com.mx | liverpool.com.mx |
| Barbie, Hot Wheels, Fisher-Price, Mega Bloks, Matchbox (Mattel) | shop.mattel.com | liverpool.com.mx, walmart.com.mx |
| Crayola | crayola.com | amazon.com.mx |
| Novelty (rompecabezas Disney, Marvel, Star Wars, Dragon Ball) | novelty.com.mx (sitio no verificado en el lote 1) | amazon.com.mx |
| Libros Disney (claves 13429…, editorial Dreams Art) | sin sitio del editor encontrado | amazon.com.mx, mercadolibre.com.mx |
| Hasbro (Jenga, Monopoly, Nerf, Play-Doh, Peppa Pig) | hasbro.com | liverpool.com.mx |
| Apache (triciclos, scooters, montables) | apache.com.mx | coppel.com |
| Injusa, Prinsel | sitio de la marca | liverpool.com.mx |

Consulta tipo: `"<marca> <nombre limpio del producto>"` con dominios limitados a la tabla.
Máximo **2 búsquedas** por producto; si no aparece, `manual`.

## Paso 3: niveles

| Nivel | Criterio | Ejemplo del lote 1 |
|---|---|---|
| `muy_alta` | Ficha del **fabricante**, mismo producto y presentación, sin variantes que confundan | TELESCOPIO MI ALEGRIA 20x40MM → mialegria.com.mx/products/telescopio-20x-40mm-mi-alegria |
| `alta` | Mismo producto, pero falta confirmar color, edición o presentación; o ficha de tienda grande y no del fabricante | TABLET CRECE CONMIGO FISHER PRICE (hay rosa y azul) |
| `media` | La marca tiene varios modelos parecidos y no se puede saber cuál es | BARBIE CLINICA MEDICA (HFT68 o HKT79); Rompecabezas Mandalorian (3 en 1, 500 o 1000 piezas) |
| `manual` | Sin ficha del mismo producto, descontinuado o regla del paso 1 | Dibucolorea De Mi Alegria (no está en el sitio del fabricante) |

Pistas para decidir:
- El **precio** ayuda: si la tienda vende en 269 y la ficha es de una cocina de 2,000, no es el mismo producto (`manual`).
- "Set de 4" contra "libro suelto": si no coincide la presentación, baja a `media` o `manual`.

## Paso 4: salida

CSV por lote, `docs/fotos/t42-lote-NNN.csv`, columnas:

```
clave,descripcion,existencia,url_imagen,url_ficha,fuente,nivel,motivo
```

- `url_ficha`: la página del producto.
- `url_imagen`: la **URL directa de la imagen** (la que se usa en el panel con "Importar desde liga").
  - Tomarla de la meta `og:image` de la ficha, o de la primera imagen de la galería.
  - Debe abrir como imagen (`image/jpeg`, `image/png` o `image/webp`), no como página, y pesar menos de 10 MB: el panel rechaza lo demás.
  - Ejemplo real (Mi Alegría, tienda en Tiendanube):
    `http://acdn-us.mitiendanube.com/stores/007/686/076/products/2514_1-cf456475604d65ec5d17798823671736-640-0.webp`
    El sufijo `-640-0` es el tamaño; si existe una versión más grande (`-1024-1024`), usar esa.
- `fuente`: dominio y si es fabricante, por ejemplo `mialegria.com.mx (fabricante)`.
- Solo `muy_alta` y `alta` necesitan `url_imagen`; en `media` basta la ficha para que una persona elija.

Al final del lote, actualizar los conteos por nivel en `t42-resumen.md` y anotar cuántas búsquedas costó.

## Derechos de las fotos

- Preferir siempre la foto del **fabricante**: es la que razonablemente se usa para revender su producto.
- Fotos de Amazon, Mercado Libre o Walmart pueden ser de otro vendedor: solo como respaldo, y marcarlo en `fuente`.
- Si no hay foto del fabricante, `manual` y la tienda toma su propia foto.
