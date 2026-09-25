-- =============================================================================
-- Endurecimiento según el linter de seguridad de Supabase (2026-09-25)
-- =============================================================================

-- search_path fijo (lint 0011).
CREATE OR REPLACE FUNCTION role_rank(p_role text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_role WHEN 'staff' THEN 1 WHEN 'admin' THEN 2 WHEN 'superadmin' THEN 3 ELSE 0 END;
$$;

-- handle_new_user solo corre como trigger; no debe ser un endpoint /rpc (lint 0028/0029).
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role SÍ debe poder ejecutarse: las políticas RLS la llaman con el rol de
-- quien consulta. Solo responde true/false sobre la sesión actual.

-- Segunda capa: la anon key no necesita ni ver que existen las tablas privadas.
-- (RLS ya devuelve 0 filas; esto además las quita del esquema GraphQL público.)
REVOKE ALL ON TABLE eleventa_catalog, orders, order_items, stock_movements, image_jobs,
                    sync_config, sync_log, audit_log, user_profiles FROM anon;
