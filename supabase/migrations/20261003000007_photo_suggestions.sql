-- =============================================================================
-- Fotos sugeridas para el catálogo (lotes de docs/fotos/t42-lote-*.csv)
-- Administración las revisa en /admin/fotos: Aceptar descarga la foto con el
-- importador del panel; Descartar solo la marca para no volver a mostrarla.
-- Las decisiones viven aquí, aparte de products.
-- =============================================================================
CREATE TABLE photo_suggestions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       text        NOT NULL,           -- eleventa_sku del producto
  source_url  text        NOT NULL,           -- imagen directa o ficha del producto (se toma su og:image)
  page_url    text,                           -- ficha, para que la persona la revise
  fuente      text,
  nivel       text        NOT NULL CHECK (nivel IN ('muy_alta', 'alta', 'media')),
  motivo      text,
  lote        text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'discarded')),
  decided_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clave, source_url)
);
CREATE INDEX idx_photo_suggestions_pending ON photo_suggestions(status, nivel) WHERE status = 'pending';

ALTER TABLE photo_suggestions ENABLE ROW LEVEL SECURITY;  -- sin políticas: solo service_role (el panel)
REVOKE ALL ON TABLE photo_suggestions FROM anon, authenticated;
