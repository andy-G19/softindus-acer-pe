-- Correlativos transaccionales para el modulo comercial.
-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron
-- PREFIJO + 8 digitos, para no duplicar correlativos ya emitidos.
-- ON CONFLICT nunca reduce ultimo_numero (GREATEST), para no romper una base ya en uso.

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'cliente',
  'CLI',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_cliente FROM 4) AS INTEGER))
      FROM aceros.cliente
      WHERE id_cliente ~ '^CLI[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para cliente (prefijo CLI).'
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
  'producto',
  'PRO',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_producto FROM 4) AS INTEGER))
      FROM aceros.producto
      WHERE id_producto ~ '^PRO[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para producto (prefijo PRO).'
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
  'categoria_producto',
  'CPR',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_categoria_producto FROM 4) AS INTEGER))
      FROM aceros.categoria_producto
      WHERE id_categoria_producto ~ '^CPR[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para categoria_producto (prefijo CPR).'
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
  'pedido',
  'PED',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_pedido FROM 4) AS INTEGER))
      FROM aceros.pedido
      WHERE id_pedido ~ '^PED[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para pedido (prefijo PED).'
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
  'detalle_pedido',
  'DPE',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_detalle_pedido FROM 4) AS INTEGER))
      FROM aceros.detalle_pedido
      WHERE id_detalle_pedido ~ '^DPE[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para detalle_pedido (prefijo DPE).'
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
  'proforma',
  'PRF',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_proforma FROM 4) AS INTEGER))
      FROM aceros.proforma
      WHERE id_proforma ~ '^PRF[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para proforma (prefijo PRF).'
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
  'pago_cliente',
  'PCL',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_pago_cliente FROM 4) AS INTEGER))
      FROM aceros.pago_cliente
      WHERE id_pago_cliente ~ '^PCL[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para pago_cliente (prefijo PCL).'
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
  'comprobante_venta',
  'CMP',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_comprobante FROM 4) AS INTEGER))
      FROM aceros.comprobante_venta
      WHERE id_comprobante ~ '^CMP[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para comprobante_venta (prefijo CMP).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);
