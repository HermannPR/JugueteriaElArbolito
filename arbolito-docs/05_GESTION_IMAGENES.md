# 05 — Gestión de Imágenes (~2,400 productos)

> **El reto:** Hay 2,395 productos exportados de Eleventa y la gran mayoría NO tiene imagen. Subir todas manualmente es inviable. Este documento define una estrategia en capas para que el sistema no "explote" y el trabajo sea manejable.

---

## A. Principio: No Bloquear la Tienda

Un producto sin imagen NO debe verse roto en la tienda. Solución: **placeholder por categoría**. Mientras un producto no tenga imagen propia, se muestra una imagen genérica bonita de su categoría (un placeholder de "muñecas", "dinosaurios", etc.). La tienda siempre se ve completa.

---

## B. Estrategia en 4 Capas (de menos a más esfuerzo manual)

### Capa 1 — Placeholder por categoría (automático, inmediato)
- Cada categoría tiene una `imagen_placeholder` (campo a agregar en `categories`).
- Productos sin imagen muestran el placeholder de su categoría.
- **Cubre el 100% desde el día 1.** Nada se ve vacío.

### Capa 2 — Búsqueda automática asistida (semi-automático)
- Un proceso busca imágenes candidatas por el nombre del producto.
- Usa una API de búsqueda de imágenes (ver sección C).
- Guarda 3-5 URLs candidatas en `image_jobs.suggested_urls`.
- El admin solo **aprueba con un clic** la mejor → se descarga y guarda en Supabase Storage.
- **Cubre estimado 50-70%** de productos con nombres reconocibles.

### Capa 3 — URL externa manual (rápido)
- Si el proveedor del juguete tiene la imagen en su sitio, el admin pega la URL.
- El sistema la descarga y cachea en Supabase Storage (no depende del sitio externo).

### Capa 4 — Subida manual (último recurso)
- Para productos únicos o sin resultados, el admin sube una foto desde su compu/celular.
- El sistema genera automáticamente miniaturas (ver sección D).

---

## C. Búsqueda Automática de Imágenes

### Opciones de API
| Servicio | Costo | Notas |
|----------|-------|-------|
| Google Custom Search API | 100 búsquedas/día gratis, luego ~$5 USD/1000 | Mejor calidad |
| Bing Image Search API | De pago | Buena alternativa |
| SerpAPI | De pago, fácil | Wrapper sencillo |

### Cómo funciona el proceso (Edge Function o script)
```
Para cada producto sin imagen (priorizado por stock/ventas):
  1. Construir query: "{nombre_producto} juguete"
  2. Llamar API de búsqueda de imágenes → obtener 5 resultados
  3. Filtrar: tamaño mínimo, formato válido, evitar marcas de agua obvias
  4. Guardar URLs en image_jobs.suggested_urls
  5. Marcar image_jobs.status = 'auto_suggested'
```

> **No descargar todas automáticamente.** Solo se guardan las URLs candidatas. La imagen se descarga a Storage únicamente cuando el admin aprueba una. Esto evita llenar Storage de basura y respeta el control de calidad.

### Priorización (qué resolver primero)
El admin no necesita resolver 2,400 de golpe. Ordenar la cola así:
1. Productos **destacados** y **más vendidos**.
2. Productos con **más stock** (más probable que se vendan).
3. El resto, por lotes, con el tiempo.

> Con placeholders cubriendo todo, se pueden ir resolviendo imágenes reales gradualmente sin presión.

---

## D. Procesamiento y Almacenamiento (que no explote)

### Supabase Storage con transformación
- Las imágenes viven en un bucket de Supabase Storage (ej. `product-images`).
- Estructura: `product-images/{product_id}/{nombre}.webp`.
- **Convertir a WebP** al subir → 25-35% menos peso que JPG.
- Generar 3 tamaños:
  - `thumb` (200px) — para grids y listas.
  - `medium` (600px) — para detalle de producto.
  - `large` (1200px) — para zoom.

> Supabase Storage soporta transformación de imágenes on-the-fly (resize por URL). Alternativa: generar los tamaños al subir con una Edge Function usando `sharp`.

### Por qué no "explota"
- Las imágenes NO se guardan en la base de datos (solo las URLs).
- Storage escala a miles de imágenes sin problema.
- WebP + tamaños correctos → el navegador descarga solo lo que necesita.
- CDN de Supabase sirve las imágenes cacheadas.

---

## E. Flujo en el Panel Admin (pantalla `/admin/imagenes`)

```
┌─────────────────────────────────────────────────────┐
│  Cola de Imágenes — 1,847 productos sin imagen        │
│  [Ordenar por: Más vendidos ▼]                        │
├─────────────────────────────────────────────────────┤
│  Producto: "DINOSAURIO T-REX GIGANTE"                 │
│  SKU: 750123... | Stock: 12 | Categoría: Dinosaurios  │
│                                                       │
│  Sugerencias automáticas:                             │
│  [img1] [img2] [img3] [img4] [img5]                   │
│   ✓ usar  ✓ usar  ✓ usar  ✓ usar  ✓ usar             │
│                                                       │
│  O: [Pegar URL____________] [Subir archivo]           │
│                                                       │
│  [Saltar]  [Siguiente →]                              │
└─────────────────────────────────────────────────────┘
```

- Un clic en "usar" → descarga la imagen, la procesa, la asigna al producto, pasa al siguiente.
- Modo lote: el admin puede resolver decenas en pocos minutos.

---

## F. Resumen de la Estrategia

| Capa | Cobertura | Esfuerzo | Cuándo |
|------|-----------|----------|--------|
| Placeholder por categoría | 100% | Cero (automático) | Día 1 |
| Búsqueda automática + 1 clic | ~50-70% | Bajo | Semanas 1-4 |
| URL externa manual | ~10-20% | Medio | Continuo |
| Subida manual | El resto | Alto | Solo lo necesario |

**Resultado:** La tienda se ve completa desde el día 1 (placeholders), y las imágenes reales se van completando gradualmente, empezando por lo que más se vende.
