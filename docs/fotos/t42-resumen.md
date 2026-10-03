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

Lista en `t42-lote-001.csv`. Columnas `liga_foto`, `fuente`, `nivel`, `motivo` vacías.

**Bloqueado:** la herramienta de búsqueda web aparece, pero al usarla pide un permiso que no está concedido en la sesión de hm-agentd (las 10 primeras búsquedas fallaron por eso). Hay que dar permiso a WebSearch/WebFetch para arbolito o pasar el lote a otro proceso.

Costo de este turno: solo lectura del seed y unas 15 llamadas a herramientas; 0 búsquedas web efectivas.
