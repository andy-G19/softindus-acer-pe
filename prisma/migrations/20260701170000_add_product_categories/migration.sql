CREATE TABLE IF NOT EXISTS aceros.categoria_producto (
  id_categoria_producto CHAR(11) PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  descripcion TEXT,
  estado BOOLEAN NOT NULL DEFAULT true,
  fecha_registro TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS categoria_producto_nombre_key
  ON aceros.categoria_producto (nombre);

CREATE UNIQUE INDEX IF NOT EXISTS categoria_producto_slug_key
  ON aceros.categoria_producto (slug);

CREATE INDEX IF NOT EXISTS idx_categoria_producto_estado
  ON aceros.categoria_producto (estado);

INSERT INTO aceros.categoria_producto (
  id_categoria_producto,
  nombre,
  slug,
  descripcion,
  estado
)
VALUES
  ('CPR00000001', 'Lampa', 'lampa', 'Categoria base para productos tipo lampa.', true),
  ('CPR00000002', 'Rastrillo', 'rastrillo', 'Categoria base para productos tipo rastrillo.', true),
  ('CPR00000003', 'Tripode', 'tripode', 'Categoria base para productos tipo tripode.', true),
  ('CPR00000004', 'Otro', 'otro', 'Categoria base para productos generales.', true)
ON CONFLICT (slug) DO NOTHING;
