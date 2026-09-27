-- =============================================================================
-- Detección de "agente sin reportar" (staleness) para el panel/servidor.
--
-- El agente actualiza sync_config.last_heartbeat en cada sincronización exitosa
-- (lo hace la función sync_eleventa_snapshot) y marca agent_status='offline'
-- cuando falla. Pero si la PC se apaga o el proceso muere en seco, NADIE
-- actualiza esas columnas: el estado se queda "congelado". Por eso el panel no
-- debe confiar solo en agent_status, sino comparar last_heartbeat contra ahora.
--
-- Estas son CONSULTAS DE LECTURA para el panel/servidor. NO cambian producción.
-- (No es una migración: nada aquí altera el esquema.)
-- =============================================================================

-- 1) ¿Está "stale" (sin reportar hace más de X minutos)? Ajustar el intervalo.
SELECT
  agent_status,
  last_heartbeat,
  now() - last_heartbeat                                  AS antiguedad,
  (last_heartbeat IS NULL
     OR now() - last_heartbeat > interval '15 minutes')   AS esta_stale
FROM sync_config
WHERE id = 1;

-- 2) Estado efectivo para mostrar en el panel:
--    - 'nunca'   : jamás reportó.
--    - 'sin_reportar' : lleva demasiado tiempo callado (probable PC apagada/proceso muerto).
--    - agent_status  : lo que el propio agente reportó (online/offline).
--    Regla sugerida: umbral = 3 x intervalo de sync (por defecto 5 min -> 15 min).
SELECT
  CASE
    WHEN last_heartbeat IS NULL THEN 'nunca'
    WHEN now() - last_heartbeat > interval '15 minutes' THEN 'sin_reportar'
    ELSE agent_status
  END AS estado_efectivo,
  last_heartbeat,
  last_sync_products
FROM sync_config
WHERE id = 1;

-- 3) Opcional: función helper que el panel puede llamar (SELECT is_agent_stale()).
--    Si se quiere, aplicarla como su propia migración; aquí queda solo como
--    referencia (comentada) para no tocar producción desde este archivo.
--
-- CREATE OR REPLACE FUNCTION is_agent_stale(p_max_minutes integer DEFAULT 15)
-- RETURNS boolean LANGUAGE sql STABLE AS $$
--   SELECT last_heartbeat IS NULL
--          OR now() - last_heartbeat > make_interval(mins => p_max_minutes)
--   FROM sync_config WHERE id = 1;
-- $$;
