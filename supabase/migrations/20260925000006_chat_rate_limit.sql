-- =============================================================================
-- Límite de uso del chatbot (por visitante, compartido entre instancias de Vercel)
-- La llave es un hash del IP: no se guarda el IP en claro.
-- =============================================================================
CREATE TABLE chat_rate_limits (
  key          text        PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits         integer     NOT NULL DEFAULT 0
);
ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;  -- sin políticas: solo service_role
REVOKE ALL ON TABLE chat_rate_limits FROM anon, authenticated;

-- Registra un mensaje y dice si todavía está dentro del límite. Atómico.
CREATE OR REPLACE FUNCTION chat_rate_hit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hits integer;
BEGIN
  INSERT INTO chat_rate_limits AS r (key, window_start, hits) VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits         = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1 ELSE r.hits + 1 END,
    window_start = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now() ELSE r.window_start END
  RETURNING hits INTO v_hits;

  -- Limpieza ocasional de ventanas viejas (1 de cada ~50 llamadas).
  IF random() < 0.02 THEN
    DELETE FROM chat_rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_hits <= p_limit;
END;
$$;
REVOKE EXECUTE ON FUNCTION chat_rate_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION chat_rate_hit(text, integer, integer) TO service_role;
