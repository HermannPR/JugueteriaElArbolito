-- =============================================================================
-- Roles del panel, bloqueo de productos y bitácora de cambios
--
-- Roles (de menor a mayor):
--   customer   → cliente de la tienda, sin acceso al panel
--   staff      → empleado: fotos, categoría, descripción y publicar
--   admin      → dueña: además stock, precios, bloqueo, pedidos e historial
--   superadmin → soporte técnico: además estado del sistema y usuarios
--
-- Desde aquí, TODAS las escrituras del panel pasan por server actions que
-- validan el rol y usan la service_role. Por eso las políticas de RLS solo
-- conceden LECTURA; el navegador ya no escribe directo en ninguna tabla.
-- =============================================================================

-- --- Roles --------------------------------------------------------------------
ALTER TABLE user_profiles
  ADD COLUMN role text NOT NULL DEFAULT 'customer'
  CHECK (role IN ('customer', 'staff', 'admin', 'superadmin'));

UPDATE user_profiles SET role = 'admin' WHERE is_admin;

CREATE OR REPLACE FUNCTION role_rank(p_role text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role WHEN 'staff' THEN 1 WHEN 'admin' THEN 2 WHEN 'superadmin' THEN 3 ELSE 0 END;
$$;

-- ¿El usuario de la sesión tiene al menos este rol?
CREATE OR REPLACE FUNCTION has_role(p_min_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role_rank(role) >= role_rank(p_min_role)
  );
$$;

-- --- Reemplazar políticas basadas en is_admin() ---------------------------------
DROP POLICY categories_public_read       ON categories;
DROP POLICY categories_admin_write       ON categories;
DROP POLICY subcategories_public_read    ON subcategories;
DROP POLICY subcategories_admin_write    ON subcategories;
DROP POLICY products_public_read         ON products;
DROP POLICY products_admin_write         ON products;
DROP POLICY store_settings_admin_write   ON store_settings;
DROP POLICY eleventa_catalog_admin       ON eleventa_catalog;
DROP POLICY orders_admin                 ON orders;
DROP POLICY order_items_admin            ON order_items;
DROP POLICY stock_movements_admin        ON stock_movements;
DROP POLICY image_jobs_admin             ON image_jobs;
DROP POLICY sync_config_admin            ON sync_config;
DROP POLICY sync_log_admin               ON sync_log;
DROP POLICY user_profiles_read_own       ON user_profiles;
DROP POLICY storage_admin_select         ON storage.objects;
DROP POLICY storage_admin_insert         ON storage.objects;
DROP POLICY storage_admin_update         ON storage.objects;
DROP POLICY storage_admin_delete         ON storage.objects;
DROP FUNCTION is_admin();
ALTER TABLE user_profiles DROP COLUMN is_admin;

CREATE POLICY categories_read       ON categories       FOR SELECT USING (is_active OR has_role('staff'));
CREATE POLICY subcategories_read    ON subcategories    FOR SELECT USING (is_active OR has_role('staff'));
CREATE POLICY products_read         ON products         FOR SELECT USING ((is_active AND is_approved) OR has_role('staff'));
CREATE POLICY image_jobs_read       ON image_jobs       FOR SELECT USING (has_role('staff'));
CREATE POLICY eleventa_catalog_read ON eleventa_catalog FOR SELECT USING (has_role('admin'));
CREATE POLICY orders_read           ON orders           FOR SELECT USING (has_role('admin'));
CREATE POLICY order_items_read      ON order_items      FOR SELECT USING (has_role('admin'));
CREATE POLICY stock_movements_read  ON stock_movements  FOR SELECT USING (has_role('admin'));
CREATE POLICY sync_config_read      ON sync_config      FOR SELECT USING (has_role('admin'));
CREATE POLICY sync_log_read         ON sync_log         FOR SELECT USING (has_role('admin'));
CREATE POLICY user_profiles_read    ON user_profiles    FOR SELECT USING (user_id = auth.uid() OR has_role('admin'));
-- Storage: sin políticas de escritura; el servidor sube las fotos (ya procesadas a WebP).

-- --- Bloqueo de productos -------------------------------------------------------
-- Distinto de is_active (que refleja si el producto sigue existiendo en Eleventa).
-- Un producto bloqueado se despublica y el panel impide volver a publicarlo.
ALTER TABLE products
  ADD COLUMN is_blocked     boolean NOT NULL DEFAULT false,
  ADD COLUMN blocked_reason text,
  ADD CONSTRAINT products_blocked_not_published CHECK (NOT (is_blocked AND is_approved));

-- Búsqueda del panel por nombre o código (ilike '%…%').
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX idx_products_name_trgm ON products USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_products_sku_trgm  ON products USING gin (eleventa_sku extensions.gin_trgm_ops);

-- --- Bitácora -------------------------------------------------------------------
CREATE TABLE audit_log (
  id          bigserial   PRIMARY KEY,
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action      text        NOT NULL,
  entity      text        NOT NULL,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entity  ON audit_log(entity, entity_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_read ON audit_log FOR SELECT USING (has_role('admin'));
