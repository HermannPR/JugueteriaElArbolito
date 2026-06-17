# 08 — Plan de Implementación y Puntos Pendientes

## A. Orden de Construcción por Fases

### FASE -1 — Setup del IDE (antes de todo) ⚙️
- [ ] Crear `CLAUDE.md` en la raíz (ya incluido en el paquete).
- [ ] Instalar tooling no negociable: MCP Supabase (ya conectado), Context7, Frontend Design, TypeScript LSP. Ver `17_TOOLING_IDE.md`.
- [ ] (Opcional) Caveman: `caveman-compress` sobre el CLAUDE.md para ahorrar tokens de entrada.
- [ ] Inicializar repo Git con la estructura `/web /agent /supabase /docs`.

### FASE 0 — Preparación de datos (antes de codear) ✅ CASI COMPLETA
- [x] Script de mapeo creado (`import_inventario.py`) — 81.5% automático, 442 a revisión.
- [x] Mapeo de los 36 departamentos a las 8 categorías existentes (ver doc 12).
- [x] **Estructura en Supabase lista:** 2 subcategorías nuevas creadas (Montables y correpasillos, Triciclos y scooters) + columnas `is_approved`, `approved_at`, `approved_by`, `price_overridden`, `category_id`, `subcategory_id` agregadas a `products`.
- [x] Generado `seed_inventario.sql` (2,395 productos para `eleventa_catalog` + `products`).
- [ ] **(IDE) Ejecutar `seed_inventario.sql`** en Supabase para cargar los 2,395 productos.
- [ ] Revisar el Excel `mapeo_inventario_revision.xlsx` (442 productos sin categoría) → el admin los ajusta desde el panel.
- [ ] Agregar campo `imagen_placeholder` a `categories` y subir un placeholder por categoría.

> **Nota:** La carga de datos se dejó para que el IDE ejecute `seed_inventario.sql` de un solo golpe (las tablas `eleventa_catalog` y `products` están vacías y listas). La estructura ya quedó aplicada en la base.

### FASE 1 — Tienda pública mínima (MVP visible)
- [ ] Setup Next.js + Tailwind + conexión a Supabase.
- [ ] Página de inicio, catálogo con filtros, detalle de producto.
- [ ] Carrito (en memoria/localStorage primero).
- [ ] Productos se ven con placeholder (aún sin imágenes reales).
- **Meta:** poder navegar el catálogo completo.

### FASE 2 — Panel admin y gestión de productos
- [ ] Auth de admin (usar `user_profiles.is_admin`).
- [ ] CRUD de productos y categorías.
- [ ] Pantalla de inventario y movimientos.
- [ ] Crear tablas nuevas: `order_items`, `stock_movements`, `image_jobs`.
- [ ] Función `apply_stock_movement`.

### FASE 3 — Sistema de imágenes
- [ ] Configurar bucket de Supabase Storage.
- [ ] Edge Function de procesamiento (WebP + tamaños).
- [ ] Pantalla `/admin/imagenes` con cola priorizada.
- [ ] Integrar API de búsqueda automática de imágenes.

### FASE 4 — Pagos y checkout
- [ ] Integrar Mercado Pago (crear preferencia + webhook).
- [ ] Flujo de checkout completo.
- [ ] Manejo de OXXO (reserva de stock).
- [ ] Casilla "¿Necesitas factura?" que guarda la solicitud (la tienda factura manual, fuera de la web).
- [ ] Emails de confirmación.

### FASE 5 — Agente de sincronización
- [ ] Lector de Firebird (`PDVDATA.FDB`).
- [ ] Cola local SQLite.
- [ ] Sincronizador con idempotencia.
- [ ] Heartbeat.
- [ ] Empaquetar como servicio Windows con autoarranque.
- [ ] Pruebas de corte de internet y reinicio.

### FASE 5.5 — Chatbot de atención
- [ ] Widget de chat flotante en el sitio.
- [ ] Backend con fallback Groq → Gemini → mensaje fijo.
- [ ] Inyección de contexto (info tienda + búsqueda de productos + estado de pedido).
- [ ] Rate limiting y límite de mensajes por sesión.
- [ ] Integrar "¿Tienes preguntas?" al final del recibo.

### FASE 6 — Pulido y lanzamiento
- [ ] Reportes.
- [ ] SEO, meta tags, sitemap.
- [ ] Páginas estáticas (nosotros desde 1975, política de no-devoluciones, envíos, contacto).
- [ ] Flujo de aprobación de productos funcionando (admin aprueba antes de publicar).
- [ ] Pruebas de carga con catálogo completo.
- [ ] Despliegue final en Vercel.

---

## B. Puntos Resueltos (ya decididos por el cliente)

Estos temas ya están definidos en `09_DECISIONES_CONFIRMADAS.md`:

| Tema | Decisión |
|------|----------|
| Envíos | Por peso/zona vía agregador (Envia/Skydropx) + recoger en tienda |
| Facturación | La hace la tienda en físico; la web NO factura (solo marca si el cliente pidió factura) |
| Precio web | Igual a Eleventa con opción de override manual (`price_overridden`) |
| Tipo de negocio | Tienda permanente -> agente 24/7 |
| Promociones | Motor de cupones desde el inicio (tabla `coupons`) |
| Notificaciones | Email (Resend) + WhatsApp Business |
| Granel | No aplica, todo por pieza |
| Cuentas cliente | Sí, login + opción invitado |
| OXXO | Reservar stock 3 días |
| Código de producto | El campo `clave` de Eleventa es la llave maestra única |

## B2. Puntos que SIGUEN pendientes (de datos, no de decisión)

### B2.1 Pesos de productos
El Excel NO trae peso y el cálculo de envío lo necesita. Plan: asignar peso estimado por categoría, refinar los más vendidos, permitir edición manual. Ver doc 11 sección E.

### B2.2 Complemento Carta Porte
Confirmar con el contador si las ventas con envío requieren Carta Porte 3.1 o si la paquetería la emite. Ver doc 10.

### B2.3 Datos del negocio a reunir
Dirección fiscal exacta, RFC, CSD del SAT, logo, contraseña de Firebird, número de WhatsApp. Ver doc 11 sección D.

---

## D. Riesgos Técnicos a Vigilar

| Riesgo | Mitigación |
|--------|-----------|
| Corromper la base de Eleventa | El agente solo LEE, nunca escribe con Eleventa abierto |
| Sobreventa (vender lo que no hay) | Buffer de seguridad + función atómica de stock |
| Doble descuento tras reinicio | `idempotency_key` en cada movimiento |
| Storage saturado de imágenes basura | Solo se guardan imágenes aprobadas, en WebP |
| Catálogo lento con 2,400 productos | Paginación, índices en DB, CDN de imágenes |
| Pérdida de venta sin internet | Cola persistente en SQLite local |

---

## E. Qué Entregar a Claude Opus 4.8 en el IDE

Entrégale **toda la carpeta de documentación** (`00` a `13`) más:
- El Excel de inventario original (`inventario_21-01-26_excel.xlsx`).
- El Excel de mapeo revisado (`mapeo_inventario_revision.xlsx`).
- El script de importación (`import_inventario.py`).
- Acceso al proyecto Supabase (project_id: `nigxlspxlurdxvwnlffu`).
- Las credenciales (ver doc 11) conforme se vayan obteniendo.
- Las respuestas del cuestionario a la dueña (doc 13) cuando estén.

Sugerencia de primer prompt para el IDE:
> "Lee toda la carpeta de docs, empezando por `09_DECISIONES_CONFIRMADAS.md` (fuente de verdad). Construiremos por fases según `08_PLAN_DE_IMPLEMENTACION.md`. La FASE 0 ya tiene el script `import_inventario.py` con el mapeo (doc 12). Tu primer trabajo: completar la parte `--execute` del script para que cree las 2 subcategorías nuevas, agregue las columnas a la DB (`price_overridden`, `category_id`, `subcategory_id`), y cargue los 2,395 productos a `eleventa_catalog` y `products` en Supabase. Respeta las 8 categorías existentes (tienen fotos)."

## F. Orden Recomendado de Trabajo en el IDE
1. FASE 0 completa (datos cargados).
2. FASE 1 (tienda visible con placeholders).
3. FASE 2 (admin + tablas nuevas).
4. En paralelo: recolectar respuestas del cuestionario (doc 13).
5. FASE 3 (imágenes), FASE 4 (pagos), FASE 5 (agente), FASE 6 (lanzamiento).
