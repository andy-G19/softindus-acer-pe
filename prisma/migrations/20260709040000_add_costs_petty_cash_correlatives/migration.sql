-- Correlativos transaccionales para los modulos Costos y Caja chica.
-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron
-- PREFIJO + 8 digitos, para no duplicar correlativos ya emitidos.
-- ON CONFLICT nunca reduce ultimo_numero (GREATEST), para no romper una base ya en uso.
-- No toca los correlativos ya existentes (BIT, MVI, comerciales, inventario, produccion).

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'costeo',
  'COS',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_costeo FROM 4) AS INTEGER))
      FROM aceros.costeo
      WHERE id_costeo ~ '^COS[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para costeo (prefijo COS).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'costo_indirecto',
  'CIN',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_costo_indirecto FROM 4) AS INTEGER))
      FROM aceros.costo_indirecto
      WHERE id_costo_indirecto ~ '^CIN[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para costo_indirecto (prefijo CIN).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'margen_ganancia',
  'MGN',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_margen FROM 4) AS INTEGER))
      FROM aceros.margen_ganancia
      WHERE id_margen ~ '^MGN[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para margen_ganancia (prefijo MGN).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'rentabilidad',
  'REN',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_rentabilidad FROM 4) AS INTEGER))
      FROM aceros.rentabilidad
      WHERE id_rentabilidad ~ '^REN[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para rentabilidad (prefijo REN).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'caja_chica',
  'CAJ',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_caja_chica FROM 4) AS INTEGER))
      FROM aceros.caja_chica
      WHERE id_caja_chica ~ '^CAJ[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para caja_chica (prefijo CAJ).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'categoria_gasto',
  'CGA',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_categoria_gasto FROM 4) AS INTEGER))
      FROM aceros.categoria_gasto
      WHERE id_categoria_gasto ~ '^CGA[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para categoria_gasto (prefijo CGA).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'movimiento_caja',
  'MCA',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_movimiento_caja FROM 4) AS INTEGER))
      FROM aceros.movimiento_caja
      WHERE id_movimiento_caja ~ '^MCA[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para movimiento_caja (prefijo MCA).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);
