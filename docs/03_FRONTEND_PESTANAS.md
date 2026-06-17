# 03 — Frontend: Todas las Pestañas y Pantallas

El sistema tiene **dos aplicaciones** que comparten el mismo proyecto Next.js:
- **Tienda pública** (`/`) — la ve cualquier cliente.
- **Panel de administración** (`/admin`) — protegido, solo usuarios con `is_admin = true`.

---

## PARTE 1 — Tienda Pública

### 1.1 Inicio (`/`)
- Hero / banner principal con promociones.
- Categorías destacadas (las 8 con su emoji y color).
- Productos destacados (`is_featured = true`).
- Productos más vendidos (de `order_items`).
- Buscador prominente.

### 1.2 Catálogo (`/productos`)
- Grid de productos con imagen, nombre, precio, "agregar al carrito".
- **Filtros laterales:** categoría, subcategoría, rango de precio, disponibilidad.
- **Orden:** relevancia, precio asc/desc, novedades.
- Paginación o scroll infinito (con 2,400 productos, esto importa).
- Solo muestra productos `is_active = true`, `is_approved = true`. **Los productos agotados (`stock = 0`) se ocultan** del catálogo (decisión confirmada). Vuelven a aparecer automáticamente cuando hay stock.

### 1.3 Categoría (`/categoria/[slug]`)
- Igual que catálogo pero pre-filtrado por categoría.
- Encabezado con nombre, emoji y descripción de la categoría.

### 1.4 Detalle de Producto (`/producto/[id]`)
- Galería de imágenes (`image_urls[]`).
- Nombre, precio, precio anterior tachado (si hay `old_price`).
- Indicador de stock disponible (con buffer aplicado).
- Botón "Agregar al carrito" con selector de cantidad.
- Descripción.
- Productos relacionados (misma categoría).

### 1.5 Carrito (`/carrito`)
- Lista de ítems con miniatura, cantidad editable, subtotal.
- Cálculo de envío estimado (por peso, usa `products.weight`).
- Total.
- Botón "Proceder al pago".

### 1.6 Checkout (`/checkout`)
- Datos del cliente (nombre, email, teléfono).
- Dirección de envío (o selección de dirección guardada si tiene cuenta).
- Método de entrega: envío a domicilio / recoger en tienda.
- Método de pago: tarjeta, OXXO, transferencia (vía Mercado Pago).
- Casilla opcional "¿Necesitas factura?" → si la marca, se guarda `factura_solicitada=true` y opcionalmente sus datos fiscales en `datos_factura`. **La factura la genera la tienda manualmente** (no se factura en línea).
- Resumen final → redirige a Mercado Pago Checkout Pro.

### 1.7 Confirmación (`/pedido/[order_number]`)
- "¡Gracias por tu compra!" con número de orden.
- Estado del pago.
- Si es OXXO: muestra el voucher/referencia para pagar.
- **Al final del recibo: "¿Tienes preguntas?"** → botón al chatbot y a la sección de contacto (correo y WhatsApp). (Nota de la dueña.)

### 1.7b Chatbot (widget flotante en todo el sitio)
- Burbuja de chat presente en todas las páginas.
- Responde dudas, ayuda a encontrar productos, da estado de pedido.
- Fallback Groq → Gemini → mensaje fijo. Ver `14_CHATBOT.md`.

### 1.8 Mi Cuenta (`/cuenta`) — requiere login
- Mis pedidos (historial con estados).
- Mis direcciones (CRUD).
- Datos de perfil.

### 1.9 Páginas estáticas
- `/nosotros` (tradición desde 1975; puede incluir el video institucional de YouTube: https://www.youtube.com/watch?v=w0o04umwA_c), `/contacto`, `/preguntas-frecuentes`, `/politicas`, `/envios`.
- **Dirección de la tienda:** Mariano Escobedo 294-Poniente, Primer Cuadro, Centro, 80000 Culiacán Rosales, Sinaloa.
- **Política de "no devoluciones"**: se aclara explícitamente en `/politicas`. NO hay módulo de devoluciones (decisión confirmada).

---

## PARTE 2 — Panel de Administración (`/admin`)

### 2.1 Dashboard (`/admin`)
- Tarjetas resumen: ventas del día/mes, órdenes pendientes, productos sin stock, productos sin imagen.
- Gráfica de ventas (online vs físico).
- **Estado del agente de sincronización** (online/offline, último heartbeat) — lee de `sync_config`.
- Alertas: productos bajo inventario mínimo.

### 2.2 Productos (`/admin/productos`)
- Tabla con buscador, filtros, paginación.
- Columnas: imagen (o placeholder), nombre, SKU Eleventa, precio, stock, **estado de aprobación**, publicado sí/no.
- Acciones: editar, **aprobar**, publicar/despublicar, agregar imagen.
- **Indicador visual de productos sin imagen** (los que urgen).

> **Flujo de aprobación (decisión confirmada):** Todo producto importado de Eleventa entra como **NO aprobado** (`is_approved = false`). NO aparece en la tienda hasta que un administrador lo apruebe. Esto resuelve el caso de mobiliario de exhibición y artículos que no son juguete: simplemente no se aprueban. Un producto aparece en línea solo si: `is_approved = true` AND `is_active = true` AND tiene imagen (o se permite con placeholder, configurable).

### 2.3 Editar Producto (`/admin/productos/[id]`)
- Editar nombre, descripción, precio web (puede diferir de Eleventa), categoría/subcategoría.
- **Gestión de imágenes** (ver documento 05): subir, buscar automático, pegar URL, reordenar.
- Marcar como destacado.
- Ver historial de movimientos de stock de ese producto.

### 2.4 Cola de Imágenes (`/admin/imagenes`)
**Pantalla dedicada para resolver el problema de 2,400 productos sin imagen.**
- Lista de productos sin imagen ordenados por prioridad (más vendidos / con más stock primero).
- Para cada uno: muestra 3-5 imágenes sugeridas automáticamente → admin aprueba con un clic.
- Modo "lote": revisar muchos productos rápido, uno tras otro.

### 2.5 Categorías (`/admin/categorias`)
- CRUD de categorías y subcategorías.
- Reordenar (`display_order`), cambiar emoji/color, activar/desactivar.

### 2.6 Órdenes (`/admin/ordenes`)
- Tabla de todas las órdenes con filtros por estado y fecha.
- Detalle de orden: ítems, cliente, dirección, pago.
- Cambiar estado (pending → processing → shipped → delivered).
- Cada cambio registra en `order_status_history`.

### 2.7 Inventario (`/admin/inventario`)
- Vista del stock actual (físico vs disponible web vs buffer).
- Registrar entradas de mercancía (genera `stock_movements` tipo `restock`).
- Ajustes manuales (con nota obligatoria).
- Ver `inventory_snapshots` históricos.

### 2.8 Sincronización (`/admin/sincronizacion`)
- Estado del agente (online/offline, último sync, duración).
- Log de sincronizaciones (`sync_log`): cuántos productos, errores.
- Configuración: intervalo, buffer de seguridad, sync de precios on/off.
- **Cola pendiente:** ventas físicas u online que aún no se han conciliado.

### 2.9 Reportes (`/admin/reportes`)
- Productos más vendidos (de `order_items`).
- Ventas por categoría.
- Ventas por canal (web vs físico).
- Exportar a CSV/Excel.

### 2.10 Configuración (`/admin/configuracion`)
- Datos de la tienda (`store_settings`): nombre, logo, contacto, redes.
- Configuración de envíos (costos, zonas).
- Usuarios admin.

---

## Resumen de Rutas

```
PÚBLICAS                          ADMIN (protegidas)
/                                 /admin
/productos                        /admin/productos
/categoria/[slug]                 /admin/productos/[id]
/producto/[id]                    /admin/imagenes
/carrito                          /admin/categorias
/checkout                         /admin/ordenes
/pedido/[order_number]            /admin/inventario
/cuenta                           /admin/sincronizacion
/nosotros /contacto ...           /admin/reportes
                                  /admin/configuracion
```
