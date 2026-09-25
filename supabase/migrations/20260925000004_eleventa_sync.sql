-- =============================================================================
-- Sincronización con Eleventa (agente de la PC de la tienda)
--
-- Esquema real de Eleventa verificado contra una copia de su FDB (Firebird 2.5):
--   PRODUCTOS.CODIGO       → clave (código de barras o clave interna)
--   PRODUCTOS.DESCRIPCION  → nombre
--   PRODUCTOS.PFINAL       → precio CON IVA (PVENTA es sin IVA: no usarlo)
--   PRODUCTOS.DINVENTARIO  → existencia, solo si USA_INVENTARIO = 't'
--   PRODUCTOS.ELIMINADO_EN → borrado lógico
--
-- Modelo: cada ciclo el agente manda la foto completa del catálogo. Es
-- idempotente (la última foto manda), así que no hace falta cola offline:
-- si no hay internet, el siguiente ciclo manda la foto actualizada.
-- =============================================================================

-- NULL = Eleventa no lleva inventario de ese producto.
ALTER TABLE eleventa_catalog
  ALTER COLUMN existencia DROP NOT NULL,
  ALTER COLUMN existencia DROP DEFAULT,
  ADD COLUMN usa_inventario boolean NOT NULL DEFAULT false;
UPDATE eleventa_catalog SET usa_inventario = true WHERE existencia IS NOT NULL;

-- Una venta web se descuenta del stock web hasta que alguien la captura en
-- Eleventa; a partir de ahí la existencia de Eleventa ya la incluye.
ALTER TABLE orders
  ADD COLUMN pos_registered_at timestamptz,
  ADD COLUMN pos_registered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION sync_eleventa_snapshot(p_rows jsonb, p_agent_version text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_started            timestamptz := clock_timestamp();
  v_cycle              text := gen_random_uuid()::text;
  v_received           integer;
  v_active_before      integer;
  v_skip_deactivation  boolean;
  v_created            integer;
  v_stock_changes      integer;
  v_price_changes      integer;
  v_reactivated        integer;
  v_deactivated        integer := 0;
  v_tracked            integer;
  v_summary            jsonb;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_rows debe ser un arreglo JSON';
  END IF;

  CREATE TEMP TABLE _snap ON COMMIT DROP AS
  SELECT DISTINCT ON (trim(r.clave))
         trim(r.clave)                         AS clave,
         nullif(trim(r.descripcion), '')       AS descripcion,
         round(r.precio, 2)                    AS precio,
         round(r.costo, 2)                     AS costo,
         r.existencia                          AS existencia,
         nullif(trim(r.departamento), '')      AS departamento
  FROM jsonb_to_recordset(p_rows) AS r(clave text, descripcion text, precio numeric, costo numeric, existencia numeric, departamento text)
  WHERE nullif(trim(r.clave), '') IS NOT NULL
  ORDER BY trim(r.clave);

  SELECT count(*), count(*) FILTER (WHERE existencia IS NOT NULL) INTO v_received, v_tracked FROM _snap;
  SELECT count(*) INTO v_active_before FROM products WHERE sync_source = 'eleventa' AND is_active;
  -- Una lectura vacía o truncada nunca debe dar de baja el catálogo.
  v_skip_deactivation := v_received < greatest(1, v_active_before / 2);

  -- 1. Espejo crudo: solo se reescriben filas que cambiaron.
  INSERT INTO eleventa_catalog AS ec (eleventa_id, clave, descripcion, precio, costo, existencia, usa_inventario, departamento, activo, last_synced_at)
  SELECT clave, clave, descripcion, precio, costo, existencia, existencia IS NOT NULL, departamento, true, now() FROM _snap
  ON CONFLICT (clave) DO UPDATE SET
    descripcion = EXCLUDED.descripcion, precio = EXCLUDED.precio, costo = EXCLUDED.costo,
    existencia = EXCLUDED.existencia, usa_inventario = EXCLUDED.usa_inventario,
    departamento = EXCLUDED.departamento, activo = true, last_synced_at = now()
  WHERE (ec.descripcion, ec.precio, ec.costo, ec.existencia, ec.usa_inventario, ec.departamento, ec.activo)
        IS DISTINCT FROM (EXCLUDED.descripcion, EXCLUDED.precio, EXCLUDED.costo, EXCLUDED.existencia, EXCLUDED.usa_inventario, EXCLUDED.departamento, true);

  -- 2. Productos nuevos en Eleventa: entran SIN publicar (los empleados los preparan).
  WITH ins AS (
    INSERT INTO products (name, price, stock, eleventa_sku, sync_source, is_approved, is_active, last_synced_at)
    SELECT coalesce(s.descripcion, s.clave), greatest(coalesce(s.precio, 0), 0),
           greatest(0, floor(coalesce(s.existencia, 0)))::integer, s.clave, 'eleventa', false, true, now()
    FROM _snap s
    WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.eleventa_sku = s.clave)
    RETURNING 1
  ) SELECT count(*) INTO v_created FROM ins;

  UPDATE eleventa_catalog ec SET linked_product_id = p.id
  FROM products p
  WHERE p.eleventa_sku = ec.clave AND ec.linked_product_id IS DISTINCT FROM p.id;

  -- 3. Stock web = existencia Eleventa − ventas web pagadas aún no capturadas en Eleventa.
  --    Solo para productos cuyo inventario lleva Eleventa; los demás quedan manuales.
  CREATE TEMP TABLE _pending ON COMMIT DROP AS
  SELECT oi.eleventa_sku AS clave, sum(oi.quantity)::integer AS qty
  FROM order_items oi JOIN orders o ON o.id = oi.order_id
  WHERE o.payment_status = 'paid' AND o.pos_registered_at IS NULL
    AND o.order_status <> 'cancelled' AND oi.eleventa_sku IS NOT NULL
  GROUP BY oi.eleventa_sku;

  WITH target AS (
    SELECT p.id, p.stock AS before,
           greatest(0, floor(s.existencia)::integer - coalesce(pe.qty, 0)) AS after
    FROM products p
    JOIN _snap s ON s.clave = p.eleventa_sku
    LEFT JOIN _pending pe ON pe.clave = s.clave
    WHERE s.existencia IS NOT NULL
  ), changed AS (
    SELECT * FROM target WHERE before <> after
  ), upd AS (
    UPDATE products p SET stock = c.after, last_synced_at = now() FROM changed c WHERE p.id = c.id RETURNING 1
  ), mov AS (
    INSERT INTO stock_movements (product_id, reason, quantity_delta, stock_before, stock_after, idempotency_key, notes)
    SELECT id, 'eleventa_sync', after - before, before, after, 'sync:' || v_cycle || ':' || id, 'Sincronización con Eleventa'
    FROM changed
    RETURNING 1
  ) SELECT count(*) INTO v_stock_changes FROM changed;

  -- 4. Precio: el de Eleventa, salvo que administración lo haya fijado a mano.
  WITH upd AS (
    UPDATE products p SET price = s.precio, last_synced_at = now()
    FROM _snap s
    WHERE p.eleventa_sku = s.clave AND NOT p.price_overridden
      AND s.precio IS NOT NULL AND s.precio > 0 AND p.price IS DISTINCT FROM s.precio
    RETURNING 1
  ) SELECT count(*) INTO v_price_changes FROM upd;

  -- 5. Altas y bajas en Eleventa.
  WITH upd AS (
    UPDATE products p SET is_active = true
    FROM _snap s WHERE p.eleventa_sku = s.clave AND NOT p.is_active
    RETURNING 1
  ) SELECT count(*) INTO v_reactivated FROM upd;

  IF NOT v_skip_deactivation THEN
    WITH upd AS (
      UPDATE products p SET is_active = false
      WHERE p.sync_source = 'eleventa' AND p.is_active
        AND NOT EXISTS (SELECT 1 FROM _snap s WHERE s.clave = p.eleventa_sku)
      RETURNING 1
    ) SELECT count(*) INTO v_deactivated FROM upd;
    UPDATE eleventa_catalog ec SET activo = false
    WHERE ec.activo AND NOT EXISTS (SELECT 1 FROM _snap s WHERE s.clave = ec.clave);
  END IF;

  v_summary := jsonb_build_object(
    'received', v_received, 'tracked_inventory', v_tracked, 'created', v_created,
    'stock_changes', v_stock_changes, 'price_changes', v_price_changes,
    'reactivated', v_reactivated, 'deactivated', v_deactivated,
    'deactivation_skipped', v_skip_deactivation, 'agent_version', p_agent_version
  );

  UPDATE sync_config SET agent_status = 'online', last_heartbeat = now(),
         last_sync_products = v_received, pending_queue_count = 0
  WHERE id = 1;

  INSERT INTO sync_log (products_synced, errors, duration_seconds, notes)
  VALUES (v_received, 0, round(extract(epoch FROM clock_timestamp() - v_started)::numeric, 2), v_summary::text);

  RETURN v_summary;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_eleventa_snapshot(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION sync_eleventa_snapshot(jsonb, text) TO service_role;
