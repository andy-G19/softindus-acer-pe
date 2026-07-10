-- Correlativos transaccionales para el modulo inventario.
-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron
-- PREFIJO + 8 digitos, para no duplicar correlativos ya emitidos.
-- ON CONFLICT nunca reduce ultimo_numero (GREATEST), para no romper una base ya en uso.
-- No toca los correlativos ya existentes (BIT, MVI, CLI, PRO, CPR, PED, DPE, PRF, PCL, CMP).

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'material',
  'MAT',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_material FROM 4) AS INTEGER))
      FROM aceros.material
      WHERE id_material ~ '^MAT[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para material (prefijo MAT).'
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
  'categoria_material',
  'CMA',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_categoria_material FROM 4) AS INTEGER))
      FROM aceros.categoria_material
      WHERE id_categoria_material ~ '^CMA[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para categoria_material (prefijo CMA).'
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
  'proveedor',
  'PVE',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_proveedor FROM 4) AS INTEGER))
      FROM aceros.proveedor
      WHERE id_proveedor ~ '^PVE[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para proveedor (prefijo PVE).'
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
  'tipo_proveedor_catalogo',
  'TPR',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_tipo_proveedor FROM 4) AS INTEGER))
      FROM aceros.tipo_proveedor_catalogo
      WHERE id_tipo_proveedor ~ '^TPR[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para tipo_proveedor_catalogo (prefijo TPR).'
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
  'proveedor_material',
  'PVM',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_proveedor_material FROM 4) AS INTEGER))
      FROM aceros.proveedor_material
      WHERE id_proveedor_material ~ '^PVM[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para proveedor_material (prefijo PVM).'
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
  'compra',
  'COM',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_compra FROM 4) AS INTEGER))
      FROM aceros.compra
      WHERE id_compra ~ '^COM[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para compra (prefijo COM).'
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
  'detalle_compra',
  'DCO',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_detalle_compra FROM 4) AS INTEGER))
      FROM aceros.detalle_compra
      WHERE id_detalle_compra ~ '^DCO[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para detalle_compra (prefijo DCO).'
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
  'historial_precio_proveedor',
  'HPP',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_historial_precio FROM 4) AS INTEGER))
      FROM aceros.historial_precio_proveedor
      WHERE id_historial_precio ~ '^HPP[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para historial_precio_proveedor (prefijo HPP).'
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
  'pago_proveedor',
  'PPR',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_pago_proveedor FROM 4) AS INTEGER))
      FROM aceros.pago_proveedor
      WHERE id_pago_proveedor ~ '^PPR[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para pago_proveedor (prefijo PPR).'
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
  'alerta_stock',
  'ALE',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_alerta FROM 4) AS INTEGER))
      FROM aceros.alerta_stock
      WHERE id_alerta ~ '^ALE[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para alerta_stock (prefijo ALE).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);
