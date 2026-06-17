# 02 — Base de Datos (Supabase / PostgreSQL)

> **Estado actual:** El proyecto Supabase `el-arbolito-jugueteria` (`nigxlspxlurdxvwnlffu`) ya tiene 12 tablas con RLS activado. Hay 8 categorías y 24 subcategorías ya creadas, pero 0 productos cargados. Este documento describe lo que existe, lo que hay que ajustar y lo que hay que agregar.

---

## Estrategia de Carga Inicial (CONFIRMADA)

El Excel de inventario es de hace unos meses, pero tiene la **misma estructura** que el Eleventa actual. Decisión: **carga híbrida**.

1. **Seed inicial desde el Excel:** se cargan los 2,395 productos del Excel a `eleventa_catalog` y `products` con su mapeo de categorías (ver doc 12). Esto da contenido inmediato para empezar a trabajar imágenes, descripciones y diseño SIN depender de que el agente ya esté instalado.
2. **El agente actualiza al conectarse:** cuando el agente de sincronización se instala en la PC de la tienda y lee el `PDVDATA.FDB` actual, **reconcilia**:
   - Productos que ya no existen en Eleventa → marcar `is_active = false` (no borrar).
   - Productos nuevos en Eleventa que no estaban en el Excel → crear en `eleventa_catalog`.
   - Existencias y precios → se actualizan a los valores reales actuales.
   - El match se hace por `clave` (SKU de Eleventa), que es estable.

> **Importante:** El seed del Excel es un punto de partida, NO la verdad final. La verdad de stock/precio siempre es el Eleventa en vivo vía el agente. Por eso el `upsert` del agente debe usar `clave` como llave y nunca duplicar.

---

## A. Tablas Existentes (conservar)

### `products` — Catálogo que ve la web
Columnas clave: `id`, `name`, `description`, `price`, `old_price`, `category` (texto), `subcategory` (texto), `image_url`, `image_urls[]`, `stock`, `weight`, `is_featured`, `is_active`, `eleventa_sku`, `stock_buffer`, `sync_source`, `last_synced_at`.

### `eleventa_catalog` — Espejo crudo de Eleventa
Columnas clave: `eleventa_id`, `clave` (única), `descripcion`, `precio`, `costo`, `existencia`, `departamento`, `activo`, `granel`, `linked_product_id` (FK → products), `is_published`, `last_synced_at`.

> **Concepto clave:** `eleventa_catalog` es el "crudo" que llega de Eleventa. `products` es lo "curado" que se publica en la web. Un registro de Eleventa se vincula a un producto web mediante `linked_product_id`. Esto permite tener 2,395 productos en Eleventa pero publicar solo los que ya tienen imagen y descripción.

### `categories` y `subcategories`
Ya pobladas con 8 categorías y 24 subcategorías. Tienen `emoji`, `color`, `slug`, `display_order`, `is_active`.

### `orders` — Órdenes online
Incluye `order_number`, datos de cliente, `shipping_address` (jsonb), `items` (jsonb), totales, `payment_method` (card/oxxo/transfer), `payment_status`, `order_status`, `stripe_payment_intent_id`, `sync_status`.

> **Ajuste necesario:** Cambiar la referencia de Stripe a Mercado Pago (ver más abajo).

### Otras existentes
`order_status_history`, `addresses`, `user_profiles` (con `is_admin`), `store_settings`, `sync_config`, `sync_log`, `inventory_snapshots`.

---

## B. Ajustes a Tablas Existentes

### B1. `orders` → soportar Mercado Pago
```sql
ALTER TABLE orders RENAME COLUMN stripe_payment_intent_id TO payment_gateway_id;
ALTER TABLE orders ADD COLUMN payment_gateway TEXT DEFAULT 'mercadopago';
ALTER TABLE orders ADD COLUMN payment_gateway_raw JSONB; -- guarda la respuesta cruda del webhook
```

### B2. `products` → relación formal con categorías (opcional pero recomendado)
El sistema actual usa `category` como texto libre. Para reportes y filtros confiables, agregar FK:
```sql
ALTER TABLE products ADD COLUMN category_id UUID REFERENCES categories(id);
ALTER TABLE products ADD COLUMN subcategory_id UUID REFERENCES subcategories(id);
-- Mantener las columnas de texto por compatibilidad, pero llenar los _id.
```

### B3. `products` → control de precio manual (decisión confirmada)
El precio se jala de Eleventa como valor inicial, pero el admin puede sobrescribirlo. Cuando lo hace, el sync NO debe volver a pisarlo:
```sql
ALTER TABLE products ADD COLUMN price_overridden BOOLEAN DEFAULT false;
-- Si price_overridden = true, el agente de sync NO actualiza el precio desde Eleventa.
-- El stock SÍ se sigue sincronizando siempre.
```

### B4. `products` → flujo de aprobación (decisión confirmada)
Todo producto importado entra sin aprobar; un admin debe aprobarlo para que salga en la web:
```sql
ALTER TABLE products ADD COLUMN is_approved BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN approved_by UUID REFERENCES auth.users(id);
-- Un producto se muestra en la tienda solo si:
--   is_approved = true AND is_active = true
```

---

## C. Tablas NUEVAS a Crear

### C1. `order_items` — Normalizar los ítems de las órdenes
Hoy los ítems viven dentro de `orders.items` (jsonb). Eso funciona para mostrar la orden, pero hace **imposible** hacer reportes tipo "¿cuál es el juguete más vendido?". Crear:

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  eleventa_sku TEXT,                  -- redundante a propósito, para trazabilidad
  product_name TEXT NOT NULL,         -- snapshot del nombre al momento de la venta
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

### C2. `stock_movements` — Libro mayor de movimientos de inventario
**La tabla más importante para resolver el problema de sincronización.** Cada cambio de stock (venta web, venta física, ajuste manual, reabasto) queda registrado. Esto da trazabilidad total y permite reconstruir el inventario si algo falla.

```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  eleventa_sku TEXT,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'online_sale',      -- venta en la web
    'physical_sale',    -- venta en Eleventa (evento)
    'restock',          -- entrada de mercancía
    'manual_adjustment',-- corrección manual de admin
    'eleventa_sync'     -- ajuste al sincronizar con Eleventa
  )),
  quantity_delta INTEGER NOT NULL,  -- negativo = salida, positivo = entrada
  stock_before INTEGER,
  stock_after INTEGER,
  source TEXT NOT NULL,             -- 'web' | 'agent' | 'admin'
  reference_id UUID,               -- order_id u otra referencia
  idempotency_key TEXT UNIQUE,     -- evita aplicar 2 veces el mismo movimiento
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);
```

> **`idempotency_key` es crítico:** El agente offline puede reenviar el mismo movimiento tras un reinicio. Con esta llave única, Postgres rechaza el duplicado y el stock no se descuenta dos veces.

### C3. `cart` — Carrito persistente (opcional, mejora UX)
```sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,                 -- para invitados sin cuenta
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### C4b. `coupons` — Motor de cupones y descuentos
Decisión confirmada: se necesita desde el inicio.
```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,             -- ej. "NAVIDAD2026"
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL,       -- 10 = 10% o $10 según type
  min_purchase NUMERIC DEFAULT 0,        -- compra mínima para aplicar
  max_uses INTEGER,                      -- límite total de usos (null = ilimitado)
  uses_count INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  applies_to TEXT DEFAULT 'all',         -- 'all' | 'category' | 'product'
  applies_to_id UUID,                    -- categoría o producto específico
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupons(id),
  order_id UUID REFERENCES orders(id),
  user_id UUID REFERENCES auth.users(id),
  discount_applied NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
Agregar a `orders`: `coupon_code TEXT`, `discount_amount NUMERIC DEFAULT 0`.

### C4c. Facturación — fuera de alcance (la hace la tienda en físico)
**Decisión confirmada:** la facturación la hace la tienda manualmente. NO se crea tabla `invoices` ni integración de PAC. Solo se agrega un campo simple a `orders` para marcar si el cliente pidió factura:
```sql
ALTER TABLE orders ADD COLUMN factura_solicitada BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN datos_factura JSONB; -- opcional: RFC/razón social si el cliente los deja, para que la tienda facture manual
```

### C4. `image_jobs` — Cola de procesamiento de imágenes
Para el sistema de imágenes (ver documento 05). Rastrea qué productos necesitan imagen y el estado de las búsquedas automáticas.
```sql
CREATE TABLE image_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  eleventa_sku TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'auto_suggested', 'needs_review', 'approved', 'skipped'
  )),
  suggested_urls JSONB,            -- URLs candidatas de búsqueda automática
  selected_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## D. Función de Stock Atómica (clave para no sobrevender)

En lugar de "leer stock → restar → guardar" (que tiene condición de carrera), usar una función que descuenta de forma atómica y registra el movimiento:

```sql
CREATE OR REPLACE FUNCTION apply_stock_movement(
  p_product_id UUID,
  p_delta INTEGER,
  p_type TEXT,
  p_source TEXT,
  p_reference_id UUID,
  p_idempotency_key TEXT
) RETURNS JSONB AS $$
DECLARE
  v_before INTEGER;
  v_after INTEGER;
BEGIN
  -- Si ya se aplicó este movimiento, no hacer nada (idempotencia)
  IF EXISTS (SELECT 1 FROM stock_movements WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('status', 'already_applied');
  END IF;

  SELECT stock INTO v_before FROM products WHERE id = p_product_id FOR UPDATE;
  v_after := v_before + p_delta;

  IF v_after < 0 THEN
    RETURN jsonb_build_object('status', 'insufficient_stock', 'available', v_before);
  END IF;

  UPDATE products SET stock = v_after, updated_at = now() WHERE id = p_product_id;

  INSERT INTO stock_movements(
    product_id, movement_type, quantity_delta, stock_before, stock_after,
    source, reference_id, idempotency_key
  ) VALUES (
    p_product_id, p_type, p_delta, v_before, v_after,
    p_source, p_reference_id, p_idempotency_key
  );

  RETURN jsonb_build_object('status', 'ok', 'stock_after', v_after);
END;
$$ LANGUAGE plpgsql;
```

---

## E. Concepto de Stock con Buffer

El campo `products.stock_buffer` (ya existe) y la config `safety_buffer_percent` / `safety_buffer_min_units` (ya en `sync_config`) implementan esto:

**Stock que ve la web** = `stock_físico_eleventa − buffer`

Donde `buffer = MAX(safety_buffer_min_units, stock_físico × safety_buffer_percent/100)`

Ejemplo: si hay 10 unidades físicas, buffer 20% mín 2 → la web muestra máximo 8 disponibles. Esto deja un colchón para ventas físicas simultáneas en el evento.
