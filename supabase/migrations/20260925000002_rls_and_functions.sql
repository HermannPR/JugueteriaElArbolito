-- =============================================================================
-- Seguridad (RLS) y funciones
--
-- Principio: la anon key (pública, va en el navegador) solo puede LEER catálogo
-- publicado. Pedidos, costos, stock_movements y el estado del agente solo los
-- tocan admins (con sesión) o el servidor con la service_role key, que ignora RLS.
-- =============================================================================

-- ¿El usuario de la sesión es admin? SECURITY DEFINER para no depender del RLS
-- de user_profiles (y evitar recursión en sus propias políticas).
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin
  );
$$;

ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleventa_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings   ENABLE ROW LEVEL SECURITY;

-- Catálogo: lectura pública de lo publicado; escritura solo admin.
CREATE POLICY categories_public_read ON categories FOR SELECT USING (is_active OR is_admin());
CREATE POLICY categories_admin_write ON categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY subcategories_public_read ON subcategories FOR SELECT USING (is_active OR is_admin());
CREATE POLICY subcategories_admin_write ON subcategories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY products_public_read ON products FOR SELECT USING ((is_active AND is_approved) OR is_admin());
CREATE POLICY products_admin_write ON products FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY store_settings_public_read ON store_settings FOR SELECT USING (true);
CREATE POLICY store_settings_admin_write ON store_settings FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Solo admin (lectura y escritura). El servidor usa service_role.
CREATE POLICY eleventa_catalog_admin ON eleventa_catalog FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY orders_admin           ON orders           FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY order_items_admin      ON order_items      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY stock_movements_admin  ON stock_movements  FOR SELECT USING (is_admin());
CREATE POLICY image_jobs_admin       ON image_jobs       FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY sync_config_admin      ON sync_config      FOR SELECT USING (is_admin());
CREATE POLICY sync_log_admin         ON sync_log         FOR SELECT USING (is_admin());

-- Perfiles: cada quien lee el suyo; admin lee todos. Nadie se da is_admin
-- desde la API: se promueve con SQL (ver supabase/README.md).
CREATE POLICY user_profiles_read_own ON user_profiles FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- Crear perfil automáticamente al registrarse.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO user_profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------------------------------------
-- apply_stock_movement: descuenta/suma stock de forma atómica e idempotente.
-- Misma firma que usa web/src/app/api/webhooks/mercadopago/route.ts.
-- Devuelve status: ok | already_applied | insufficient_stock | not_found.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_stock_movement(
  p_product_id      uuid,
  p_delta           integer,
  p_reason          text,
  p_order_id        uuid,
  p_idempotency_key text,
  p_notes           text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before integer;
  v_after  integer;
BEGIN
  -- Bloquear la fila del producto primero: serializa movimientos concurrentes
  -- del mismo producto, incluido el mismo webhook entregado dos veces.
  SELECT stock INTO v_before FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM stock_movements WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('status', 'already_applied');
  END IF;

  v_after := v_before + p_delta;
  IF v_after < 0 THEN
    RETURN jsonb_build_object('status', 'insufficient_stock', 'available', v_before);
  END IF;

  UPDATE products SET stock = v_after WHERE id = p_product_id;

  INSERT INTO stock_movements (product_id, reason, quantity_delta, stock_before, stock_after,
                               order_id, idempotency_key, notes)
  VALUES (p_product_id, p_reason, p_delta, v_before, v_after,
          p_order_id, p_idempotency_key, p_notes);

  RETURN jsonb_build_object('status', 'ok', 'stock_after', v_after);
END;
$$;

-- Solo el servidor (service_role) mueve stock; nunca el navegador.
REVOKE EXECUTE ON FUNCTION apply_stock_movement(uuid, integer, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION apply_stock_movement(uuid, integer, text, uuid, text, text) TO service_role;

-- -----------------------------------------------------------------------------
-- Storage: buckets públicos de lectura; escritura solo admin.
--   product-images → fotos de producto (subidas desde /admin)
--   lifestyle      → fotos de la sesión (hero y /nosotros)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-images', 'product-images', true),
  ('lifestyle',      'lifestyle',      true)
ON CONFLICT (id) DO NOTHING;

-- SELECT hace falta para el upsert que usa ProductEditForm al subir fotos.
CREATE POLICY storage_admin_select ON storage.objects FOR SELECT
  USING (bucket_id IN ('product-images', 'lifestyle') AND is_admin());
CREATE POLICY storage_admin_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('product-images', 'lifestyle') AND is_admin());
CREATE POLICY storage_admin_update ON storage.objects FOR UPDATE
  USING (bucket_id IN ('product-images', 'lifestyle') AND is_admin());
CREATE POLICY storage_admin_delete ON storage.objects FOR DELETE
  USING (bucket_id IN ('product-images', 'lifestyle') AND is_admin());
