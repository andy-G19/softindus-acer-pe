CREATE TABLE IF NOT EXISTS aceros.categoria_material (
  id_categoria_material CHAR(11) PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  descripcion TEXT,
  estado BOOLEAN NOT NULL DEFAULT true,
  fecha_registro TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS categoria_material_nombre_key
  ON aceros.categoria_material (nombre);

CREATE UNIQUE INDEX IF NOT EXISTS categoria_material_slug_key
  ON aceros.categoria_material (slug);

CREATE INDEX IF NOT EXISTS idx_categoria_material_estado
  ON aceros.categoria_material (estado);

INSERT INTO aceros.categoria_material (
  id_categoria_material,
  nombre,
  slug,
  descripcion,
  estado
)
VALUES
  ('CMA00000001', 'Materia prima', 'materia_prima', 'Categoria base para materias primas.', true),
  ('CMA00000002', 'Consumible', 'consumible', 'Categoria base para consumibles.', true),
  ('CMA00000003', 'Repuesto', 'repuesto', 'Categoria base para repuestos.', true),
  ('CMA00000004', 'Herramienta', 'herramienta', 'Categoria base para herramientas.', true),
  ('CMA00000005', 'Otro', 'otro', 'Categoria base para otros materiales.', true)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS aceros.tipo_proveedor_catalogo (
  id_tipo_proveedor CHAR(11) PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  descripcion TEXT,
  estado BOOLEAN NOT NULL DEFAULT true,
  fecha_registro TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tipo_proveedor_catalogo_nombre_key
  ON aceros.tipo_proveedor_catalogo (nombre);

CREATE UNIQUE INDEX IF NOT EXISTS tipo_proveedor_catalogo_slug_key
  ON aceros.tipo_proveedor_catalogo (slug);

CREATE INDEX IF NOT EXISTS idx_tipo_proveedor_catalogo_estado
  ON aceros.tipo_proveedor_catalogo (estado);

INSERT INTO aceros.tipo_proveedor_catalogo (
  id_tipo_proveedor,
  nombre,
  slug,
  descripcion,
  estado
)
VALUES
  ('TPR00000001', 'Materia prima', 'materia_prima', 'Tipo base para proveedores de materia prima.', true),
  ('TPR00000002', 'Consumibles', 'consumibles', 'Tipo base para proveedores de consumibles.', true),
  ('TPR00000003', 'Repuestos', 'repuestos', 'Tipo base para proveedores de repuestos.', true),
  ('TPR00000004', 'Servicios', 'servicios', 'Tipo base para proveedores de servicios.', true),
  ('TPR00000005', 'Otros', 'otros', 'Tipo base para otros proveedores.', true)
ON CONFLICT (slug) DO NOTHING;
