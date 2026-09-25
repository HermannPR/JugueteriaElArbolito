-- =============================================================================
-- Juguetería El Arbolito — esquema base
-- Reconstruido el 2026-09-25 a partir del código de /web y /agent: el esquema
-- anterior nunca se guardó en el repo. Para el proyecto original ver
-- supabase/legacy/20260925_rebuild_nigxlspxlurdxvwnlffu.md.
--
-- Orden de carga en un proyecto nuevo:
--   1. supabase/migrations/*.sql  (en orden)
--   2. supabase/seed_inventario.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Categorías y subcategorías
-- Los UUID son los del proyecto original: seed_inventario.sql los referencia
-- literalmente. Se recuperaron clasificando las 2,395 filas del seed con
-- scripts/import_inventario.py (100 % de coincidencia por cada UUID).
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL UNIQUE,
  slug          text        NOT NULL UNIQUE,
  emoji         text        NOT NULL DEFAULT '',
  color         text        NOT NULL DEFAULT '#1E40AF',
  image_url     text,
  display_order integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subcategories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  slug          text        NOT NULL,
  display_order integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);
CREATE INDEX idx_subcategories_category ON subcategories(category_id);

INSERT INTO categories (id, name, slug, emoji, color, display_order) VALUES
  ('049aaedf-7847-4c84-9232-4f165451e4ec', 'Didácticos',                 'didacticos',                 '📚', '#3B82F6', 1),
  ('cc029478-05af-4998-9130-bd21084ac633', 'Muñecas y bebés',            'munecas-y-bebes',            '👶', '#EC4899', 2),
  ('fb429cc3-ed2d-4836-a8a1-ceb3d040fef4', 'Deportes',                   'deportes',                   '⚽', '#10B981', 3),
  ('58d27124-4bb6-4a94-a74b-ff784119a831', 'Dinosaurios',                'dinosaurios',                '🦕', '#F59E0B', 4),
  ('1bce9434-6ea5-4625-b83e-96ebb9e70f32', 'Libros',                     'libros',                     '📖', '#8B5CF6', 5),
  ('616bf407-ce4e-4713-a8f7-c0ab6641a745', 'Coleccionables',             'coleccionables',             '⭐', '#EF4444', 6),
  ('994bb4e9-a0fa-4ba3-a90e-5f2e27c62fac', 'Casitas y juegos de jardín', 'casitas-y-juegos-de-jardin', '🏡', '#06B6D4', 7),
  ('f10ecd65-9aae-423e-8ca4-198a5e313d49', 'Mi alegría',                 'mi-alegria',                 '🎉', '#F97316', 8);

-- Todas las subcategorías conservan el UUID del proyecto original (verificado en la base el 2026-09-25).
INSERT INTO subcategories (id, category_id, name, slug, display_order) VALUES
  ('d11da0ac-3e31-4ca8-aa66-cbebbfbd78e3', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Estimulación temprana',     'estimulacion-temprana',     1),
  ('bfe239eb-d12e-4ef4-8dba-d55026f6aa4e', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Rompecabezas',              'rompecabezas',              2),
  ('28dab8b5-479d-4d6b-82d0-2e899352627c', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Juegos de mesa',            'juegos-de-mesa',            3),
  ('414fcbfb-b501-4ea9-b554-baa83945d314', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Construcción y bloques',    'construccion-y-bloques',    4),
  ('73557552-9f60-4015-8350-8f0a37303b8f', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Ciencia y experimentos',    'ciencia-y-experimentos',    5),
  ('87ee0497-6a42-4f27-8f0c-bd2eafcd6387', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Arte y manualidades',       'arte-y-manualidades',       6),
  ('f4fee630-549d-4ec1-9f3f-818087a1b070', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Musicales',                 'musicales',                 7),
  ('f61147b3-3ea7-4dd7-9ec6-b6d95cb58110', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Matemáticas y lógica',      'matematicas-y-logica',      8),
  ('c86677ed-3ba4-4c4d-9104-1107162b3b17', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Lenguaje y lectura',        'lenguaje-y-lectura',        9),
  ('b53f0324-22c3-4c81-bf71-59a25620e698', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Motricidad fina',           'motricidad-fina',           10),
  ('1713fb3a-f42a-4e43-8b34-eb84d098f9cf', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Motricidad gruesa',         'motricidad-gruesa',         11),
  ('e0ec790d-94ac-4473-87ee-c2d1bcf61f10', '049aaedf-7847-4c84-9232-4f165451e4ec', 'Sensorial',                 'sensorial',                 12),
  ('21973bbe-3ef4-4ecd-92d3-cd00ba819f37', 'cc029478-05af-4998-9130-bd21084ac633', 'Muñecas',                   'munecas',                   1),
  ('3393bb3a-2d60-47b1-b04e-2d36b4ec72f2', 'cc029478-05af-4998-9130-bd21084ac633', 'Bebés',                     'bebes',                     2),
  ('8cdb57f4-dba8-4846-a956-27deba96253b', 'cc029478-05af-4998-9130-bd21084ac633', 'Accesorios para muñecas',   'accesorios-para-munecas',   3),
  ('97b2c54a-0211-4d63-89fa-240aa167423e', 'cc029478-05af-4998-9130-bd21084ac633', 'Carriolas y cunas',         'carriolas-y-cunas',         4),
  ('b07885d4-4911-4b46-be41-cf457d7982ca', 'cc029478-05af-4998-9130-bd21084ac633', 'Casas de muñecas',          'casas-de-munecas',          5),
  ('9eba6814-acaa-4b02-bcf0-1f8a8d21c613', 'cc029478-05af-4998-9130-bd21084ac633', 'Peluches',                  'peluches',                  6),
  ('ef5fec51-ca18-4f44-b78c-0761030161f7', 'cc029478-05af-4998-9130-bd21084ac633', 'Sets de té y cocina',       'sets-de-te-y-cocina',       7),
  ('8c31e8f7-8a12-452e-9ae1-805915fdfd56', 'fb429cc3-ed2d-4836-a8a1-ceb3d040fef4', 'Deportes al aire libre',    'deportes-al-aire-libre',    1),
  ('caa1aec7-e3bd-41f3-9a97-3a85f5c29690', 'fb429cc3-ed2d-4836-a8a1-ceb3d040fef4', 'Bicicletas y vehículos',    'bicicletas-y-vehiculos',    2),
  ('1f90932d-7a67-4c04-80f3-2abee0bb61da', 'fb429cc3-ed2d-4836-a8a1-ceb3d040fef4', 'Montables y correpasillos', 'montables-y-correpasillos', 3),
  ('c0e8261d-65c1-4cda-a041-7d9f80fca015', 'fb429cc3-ed2d-4836-a8a1-ceb3d040fef4', 'Triciclos y scooters',      'triciclos-y-scooters',      4),
  ('9383605b-c26a-4dbf-9945-05d83391714b', '1bce9434-6ea5-4625-b83e-96ebb9e70f32', 'Cuentos infantiles',        'cuentos-infantiles',        1),
  ('ccff62cc-0060-438e-ab52-63da9057951c', '1bce9434-6ea5-4625-b83e-96ebb9e70f32', 'Libros educativos',         'libros-educativos',         2),
  ('53c46d01-a614-4bb3-90c8-22f6639dd881', '1bce9434-6ea5-4625-b83e-96ebb9e70f32', 'Libros para colorear',      'libros-para-colorear',      3);

-- -----------------------------------------------------------------------------
-- Productos (lo curado que ve la web)
-- -----------------------------------------------------------------------------
CREATE TABLE products (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text          NOT NULL,
  description      text,
  price            numeric(10,2) NOT NULL CHECK (price >= 0),
  old_price        numeric(10,2) CHECK (old_price IS NULL OR old_price >= 0),
  image_url        text,
  image_urls       text[],
  stock            integer       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_buffer     integer       NOT NULL DEFAULT 0 CHECK (stock_buffer >= 0),
  weight           numeric(6,2)  CHECK (weight IS NULL OR weight >= 0),
  is_featured      boolean       NOT NULL DEFAULT false,
  is_active        boolean       NOT NULL DEFAULT true,
  is_approved      boolean       NOT NULL DEFAULT false,
  approved_at      timestamptz,
  approved_by      uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  price_overridden boolean       NOT NULL DEFAULT false,
  eleventa_sku     text          UNIQUE,
  sync_source      text          NOT NULL DEFAULT 'manual' CHECK (sync_source IN ('manual', 'eleventa')),
  last_synced_at   timestamptz,
  category_id      uuid          REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id   uuid          REFERENCES subcategories(id) ON DELETE SET NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);
-- Índice parcial para el catálogo público (activo + aprobado + con stock).
CREATE INDEX idx_products_storefront ON products(category_id, name)
  WHERE is_active AND is_approved AND stock > 0;
CREATE INDEX idx_products_pending_approval ON products(is_approved) WHERE NOT is_approved;
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured;

-- -----------------------------------------------------------------------------
-- Espejo crudo de Eleventa (incluye costo: solo admins)
-- -----------------------------------------------------------------------------
CREATE TABLE eleventa_catalog (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  eleventa_id       text,
  clave             text          NOT NULL UNIQUE,
  descripcion       text,
  precio            numeric(10,2),
  costo             numeric(10,2),
  existencia        numeric(12,3) NOT NULL DEFAULT 0,
  departamento      text,
  activo            boolean       NOT NULL DEFAULT true,
  granel            boolean       NOT NULL DEFAULT false,
  linked_product_id uuid          REFERENCES products(id) ON DELETE SET NULL,
  is_published      boolean       NOT NULL DEFAULT false,
  last_synced_at    timestamptz   NOT NULL DEFAULT now(),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE user_profiles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  phone      text,
  is_admin   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Pedidos
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        text          NOT NULL UNIQUE,
  -- Secreto que va en la liga de /pedido: sin él no se muestran datos personales.
  access_token        uuid          NOT NULL DEFAULT gen_random_uuid(),
  customer_email      text          NOT NULL,
  customer_name       text          NOT NULL,
  customer_phone      text,
  shipping_method     text          NOT NULL CHECK (shipping_method IN ('envio', 'pickup')),
  shipping_address    jsonb,
  items               jsonb         NOT NULL,
  subtotal            numeric(10,2) NOT NULL CHECK (subtotal >= 0),
  shipping_cost       numeric(10,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  total               numeric(10,2) NOT NULL CHECK (total >= 0),
  payment_method      text          NOT NULL DEFAULT 'mercadopago',
  payment_gateway     text          NOT NULL DEFAULT 'mercadopago',
  payment_gateway_id  text,
  payment_gateway_raw jsonb,
  mp_preference_id    text,
  payment_status      text          NOT NULL DEFAULT 'pending'
                      CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  -- requires_attention = pagado pero no alcanzó el stock o el monto no cuadró.
  order_status        text          NOT NULL DEFAULT 'pending'
                      CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered',
                                              'cancelled', 'requires_attention')),
  factura_solicitada  boolean       NOT NULL DEFAULT false,
  datos_factura       jsonb,
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_status  ON orders(order_status);

CREATE TABLE order_items (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   uuid          REFERENCES products(id) ON DELETE SET NULL,
  eleventa_sku text,
  name         text          NOT NULL,
  price        numeric(10,2) NOT NULL CHECK (price >= 0),
  quantity     integer       NOT NULL CHECK (quantity > 0),
  created_at   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- -----------------------------------------------------------------------------
-- Libro mayor de inventario
-- -----------------------------------------------------------------------------
CREATE TABLE stock_movements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reason          text        NOT NULL CHECK (reason IN ('sale', 'restock', 'manual_adjustment',
                                                         'eleventa_sync', 'cancellation')),
  quantity_delta  integer     NOT NULL,
  stock_before    integer     NOT NULL,
  stock_after     integer     NOT NULL,
  order_id        uuid        REFERENCES orders(id) ON DELETE SET NULL,
  idempotency_key text        NOT NULL UNIQUE,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Imágenes
-- -----------------------------------------------------------------------------
CREATE TABLE image_jobs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_url   text,
  status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  priority     integer     NOT NULL DEFAULT 5,
  error_msg    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX idx_image_jobs_status ON image_jobs(status, priority);

-- -----------------------------------------------------------------------------
-- Agente de sincronización
-- -----------------------------------------------------------------------------
CREATE TABLE sync_config (
  id                  integer     PRIMARY KEY CHECK (id = 1),
  agent_status        text        NOT NULL DEFAULT 'offline' CHECK (agent_status IN ('online', 'offline')),
  last_heartbeat      timestamptz,
  pending_queue_count integer     NOT NULL DEFAULT 0,
  last_sync_products  integer     NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
INSERT INTO sync_config (id) VALUES (1);

CREATE TABLE sync_log (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at        timestamptz  NOT NULL DEFAULT now(),
  products_synced  integer      NOT NULL DEFAULT 0,
  errors           integer      NOT NULL DEFAULT 0,
  duration_seconds numeric(8,2),
  notes            text
);
CREATE INDEX idx_sync_log_synced ON sync_log(synced_at DESC);

CREATE TABLE store_settings (
  key         text        PRIMARY KEY,
  value       jsonb       NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_categories_updated       BEFORE UPDATE ON categories       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subcategories_updated    BEFORE UPDATE ON subcategories    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated         BEFORE UPDATE ON products         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_eleventa_catalog_updated BEFORE UPDATE ON eleventa_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_profiles_updated    BEFORE UPDATE ON user_profiles    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated           BEFORE UPDATE ON orders           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sync_config_updated      BEFORE UPDATE ON sync_config      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_store_settings_updated   BEFORE UPDATE ON store_settings   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
