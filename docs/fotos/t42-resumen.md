# t42: clasificación de fotos del catálogo (paso 1, sin búsquedas)

Fuente: `supabase/seed_inventario.sql` (tabla `eleventa_catalog`, 2,395 productos; catálogo histórico, no stock actual).
Solo lectura: no se tocó la base, `image_url` ni la tienda.

## Filtro (conteos con búsqueda por regex sobre el seed)

| Grupo | Criterio | Productos |
|---|---|---|
| Cola de búsqueda | clave = código de barras (8 a 14 dígitos) | 1,540 |
| Cola de búsqueda | sin código pero con marca o licencia conocida | 29 |
| **Total cola** | | **1,569** |
| Necesita foto manual | genérico sin marca ni código | **826** |

- Con existencia > 0 y código de barras: 1,034.
- Con código **y** marca o licencia conocida y existencia > 0: ~140 (prioridad 1).
- Ojo: muchos códigos 489… / 692… son de importadores genéricos con licencia; el código existe, pero rara vez hay foto oficial del fabricante. Esperar nivel "media" o "manual" en buena parte.

Marcas usadas en el filtro: Barbie, Mattel, Hasbro, Lego, Disney (Frozen, Princesas, Minnie, Mickey, Stitch, Toy Story), Marvel (Avengers, Spider-Man), Hot Wheels, Fisher-Price, Play-Doh, Nerf, Monopoly, Jenga, Injusa, Biyu, Paw Patrol, Pokémon, Hello Kitty, Peppa Pig, Bluey, Crayola, Prinsel, Apache, Novelty, Mi Alegría, Mega Bloks, Sonic, Dragon Ball, Star Wars, entre otras.

## Paso 2: primer lote (50, marca + código + stock, ordenado por existencia)

Resultado en `t42-lote-001.csv` (liga = ficha del producto, no URL directa de la imagen; no se descargó nada).

| Nivel | Productos | Notas |
|---|---|---|
| muy_alta | 7 | Todos Mi Alegría, ficha en la tienda del fabricante |
| alta | 10 | Libros Dreams Art, Fisher-Price, Crayola, Mega Bloks: mismo producto, falta confirmar color o edición |
| media | 5 | La marca tiene varios modelos parecidos (Barbie clínica, Mandalorian, Apache) |
| manual | 19 | 10 con código 489/697 de importadores genéricos, más genéricos y descontinuados |
| pendiente | 9 | No se buscaron para medir el costo; quedan para el siguiente lote |

Aprendizajes:
- Buscar por código de barras **no sirve** (el buscador es de EE. UU. y devuelve basura). Funciona buscar por nombre y marca, limitado a tiendas de México y del fabricante.
- Los códigos 489186… y 697… (importadores con licencia Disney/Marvel) casi nunca tienen ficha oficial: conviene mandarlos directo a manual sin buscar, igual que los genéricos.
- Mi Alegría tiene catálogo completo en línea: es la marca con más rendimiento.

Costo: 25 búsquedas web (5 de prueba por código, inútiles) para 41 productos clasificados, 22 de ellos con liga. Proyección para los ~1,569 de la cola: muchos más que un turno; sugerencia: excluir 489/697 y buscar solo marcas fuertes.
