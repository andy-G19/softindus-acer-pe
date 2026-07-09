CREATE TABLE IF NOT EXISTS aceros.correlativo_sistema (
  codigo_entidad VARCHAR(80) PRIMARY KEY,
  prefijo CHAR(3) NOT NULL,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  descripcion TEXT,
  fecha_actualizacion TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron
-- PREFIJO + 8 digitos, para no duplicar correlativos ya emitidos.
INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'movimiento_inventario',
  'MVI',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_movimiento FROM 4) AS INTEGER))
      FROM aceros.movimiento_inventario
      WHERE id_movimiento ~ '^MVI[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para movimiento_inventario (prefijo MVI).'
)
ON CONFLICT (codigo_entidad) DO NOTHING;

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'bitacora_operacion',
  'BIT',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_bitacora FROM 4) AS INTEGER))
      FROM aceros.bitacora_operacion
      WHERE id_bitacora ~ '^BIT[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para bitacora_operacion (prefijo BIT).'
)
ON CONFLICT (codigo_entidad) DO NOTHING;
