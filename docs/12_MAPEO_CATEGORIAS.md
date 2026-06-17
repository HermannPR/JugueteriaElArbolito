# 12 — Mapeo de Departamentos Eleventa → Categorías Web

> **Regla confirmada:** Las 8 categorías existentes NO se tocan (ya tienen fotos de sesión). Solo se mapean los 36 departamentos de Eleventa hacia esas categorías y sus subcategorías. Se pueden AMPLIAR subcategorías si hace falta.

---

## A. El Problema

Los departamentos de Eleventa son **mixtos**:
- Algunos son por **tipo de juguete** (Muñecas, Libros, Dinosaurios, Rompecabezas) → mapeo directo y limpio.
- Otros son por **edad** (Niños 4+, Niñas, Preescolar, Infant, Toddler) → contienen tipos de juguete variados (un "Niños 4+" tiene desde ábacos hasta carritos). Estos NO se pueden mapear solo por departamento.

**Solución de 2 pasos:**
1. Mapeo directo por departamento donde sea claro.
2. Para los departamentos por edad, usar **palabras clave del nombre del producto** para inferir la subcategoría; lo que no se pueda inferir queda como `category_id = NULL` para revisión manual en `/admin/productos` (filtro "sin categoría").

---

## B. Categorías Existentes (NO modificar)

| Orden | Categoría | Subcategorías actuales |
|-------|-----------|------------------------|
| 1 | Didácticos | Estimulación temprana, Rompecabezas, Juegos de mesa, Construcción y bloques, Ciencia y experimentos, Arte y manualidades, Musicales, Matemáticas y lógica, Lenguaje y lectura, Motricidad fina, Motricidad gruesa, Sensorial |
| 2 | Muñecas y bebés | Muñecas, Bebés, Accesorios para muñecas, Carriolas y cunas, Casas de muñecas, Peluches, Sets de té y cocina |
| 3 | Deportes | Deportes al aire libre, Bicicletas y vehículos |
| 4 | Dinosaurios | *(sin subcategorías)* |
| 5 | Libros | Cuentos infantiles, Libros educativos, Libros para colorear |
| 6 | Coleccionables | *(sin subcategorías)* |
| 7 | Casitas y juegos de jardín | *(sin subcategorías)* |
| 8 | Mi alegría | *(sin subcategorías)* |

---

## C. Subcategorías Nuevas a AGREGAR (propuesta)

Para acomodar bien el inventario sin crear categorías nuevas:

### Deportes → agregar:
- **Montables y correpasillos** (para los 17 "Montables": go-karts, caballitos, jeeps eléctricos).
- **Triciclos y scooters** (para Triciclos + Scooters + Carros eléctricos).

### Muñecas y bebés → ya tiene "Sets de té y cocina", se reutiliza para el depto "Cocina" (38 productos: cocinitas, cajas registradoras).

### Didácticos → ya cubre casi todo lo educativo. El depto "Preescolar" se reparte por palabra clave entre sus subcategorías.

### Mi alegría
"Mi Alegría" es una **marca mexicana** de juguetes educativos (Dibujantes, Mi Alegría, etc.). Mantenerla como categoría de marca: los productos cuyo nombre contenga "mi alegría" / "dibucolorea" van aquí.

> **Mobiliario (13 productos)** son en su mayoría exhibidores y mesas de tienda — varios NO son producto de venta (son del negocio). Marcar para revisión manual; muchos se quedarán como `is_active = false`.

---

## D. Tabla de Mapeo Directo (departamento → categoría)

| Departamento Eleventa | → Categoría | → Subcategoría |
|----------------------|-------------|----------------|
| Didácticos | Didácticos | *(inferir por keyword, ver E)* |
| Muñecas | Muñecas y bebés | Muñecas |
| Libros | Libros | *(inferir: colorear/educativo/cuento)* |
| Deportes | Deportes | Deportes al aire libre |
| Juegos de mesa | Didácticos | Juegos de mesa |
| Manualidades | Didácticos | Arte y manualidades |
| Rompecabezas | Didácticos | Rompecabezas |
| Musicales | Didácticos | Musicales |
| Peluches | Muñecas y bebés | Peluches |
| Cocina | Muñecas y bebés | Sets de té y cocina |
| Dinosaurios | Dinosaurios | — |
| Sensoriales | Didácticos | Sensorial |
| Línea científica | Didácticos | Ciencia y experimentos |
| Estimulación temprana | Didácticos | Estimulación temprana |
| Artes | Didácticos | Arte y manualidades |
| Juegos de construcción | Didácticos | Construcción y bloques |
| Montables | Deportes | Montables y correpasillos *(nueva)* |
| Triciclos | Deportes | Triciclos y scooters *(nueva)* |
| Scooters | Deportes | Triciclos y scooters *(nueva)* |
| Carros eléctricos | Deportes | Triciclos y scooters *(nueva)* |
| Juegos al aire libre | Deportes | Deportes al aire libre |
| Casitas | Casitas y juegos de jardín | — |
| Coleccionables | Coleccionables | — |
| Newborn | Muñecas y bebés | Bebés |
| Infant 3m-1año | Muñecas y bebés | Bebés *(o inferir)* |
| Toddler 1-3 años | Didácticos | *(inferir; default Estimulación temprana)* |
| Preescolar 3-5 año | Didácticos | *(inferir por keyword)* |
| Disfraces | Coleccionables | *(o revisión manual)* |
| Tapetes | Didácticos | Sensorial *(o revisión)* |
| Bolsa para regalo | *(NULL — revisión manual, posible no-producto)* | — |
| Mobiliario | *(NULL — revisión manual, mayoría no-producto)* | — |

### Departamentos por edad (mapeo por keyword obligatorio):
| Departamento | Estrategia |
|--------------|-----------|
| Niños 4+ (274) | Inferir por keyword del nombre; default `NULL` → revisión |
| Niñas (137) | Inferir; muchos son muñecas/bebés/cocina; default `NULL` |
| Niños 5-11 años (72) | Inferir; default `NULL` |
| Sin departamento (127) | Inferir; default `NULL` |

---

## E. Diccionario de Palabras Clave (para inferencia)

El script busca estas palabras en el nombre del producto (sin acentos, minúsculas) para asignar subcategoría:

```
rompecabezas, puzzle          → Didácticos / Rompecabezas
abaco, numeros, matematic     → Didácticos / Matemáticas y lógica
bloque, construccion, lego    → Didácticos / Construcción y bloques
pintar, colorear, crayon, foamy, plastilina, acuarela → Didácticos / Arte y manualidades
tambor, guitarra, xilofono, piano, musical, sonaja    → Didácticos / Musicales
ciencia, experimento, microscopio, quimica → Didácticos / Ciencia y experimentos
libro, cuento, dibucolorea    → Libros (sub según keyword)
muñeca, muneca, barbie, doll  → Muñecas y bebés / Muñecas
bebe, baby, bambineto, sonaja, mordedera → Muñecas y bebés / Bebés
peluche, plush                → Muñecas y bebés / Peluches
cocina, cocinita, registradora, te set, postres → Muñecas y bebés / Sets de té y cocina
carriola, cuna                → Muñecas y bebés / Carriolas y cunas
dinosaurio, dino, rex, raptor → Dinosaurios
pelota, balon, futbol, basket, aro, hula → Deportes / Deportes al aire libre
bicicleta, triciclo           → Deportes / Triciclos y scooters
montable, correpasillos, go kart, jeep → Deportes / Montables y correpasillos
carrito, carro, hot wheels, truck, vehiculo → Deportes / Bicicletas y vehiculos
```

> Si ninguna keyword coincide → `category_id = NULL`, `subcategory_id = NULL`. El admin lo resuelve en `/admin/productos` con el filtro "sin categoría". Dado el volumen moderado, esta limpieza manual es totalmente manejable.

---

## F. Resultado Esperado del Mapeo

- **Mapeo limpio y automático:** ~60-70% de productos (departamentos por tipo + keywords claras).
- **Revisión manual:** ~30-40% (departamentos por edad sin keyword clara).
- Cero productos mal clasificados a la fuerza: ante la duda, queda `NULL` y se revisa, en vez de asignar mal.
