-- Correlativos transaccionales para Mermas/Chatarra y Reportes/Exportaciones.
-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron
-- PREFIJO + 8 digitos, para no duplicar correlativos ya emitidos.
-- ON CONFLICT nunca reduce ultimo_numero (GREATEST), para no romper una base ya en uso.
-- No toca los correlativos ya existentes (BIT, MVI, movimiento_caja/MCA, comerciales,
-- inventario, produccion, costos/caja chica, personal/mantenimiento).
-- No se crea correlativo para "merma" (no existe ese modelo/tabla en el schema actual;
-- el dominio de mermas/chatarra se modela con chatarra, retazo_reutilizable y venta_chatarra)
-- ni para "reporte" (el modelo existe en el schema pero ningun codigo de la aplicacion
-- genera registros de esa tabla; solo se usa exportacion_datos).

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'chatarra',
  'CHA',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_chatarra FROM 4) AS INTEGER))
      FROM aceros.chatarra
      WHERE id_chatarra ~ '^CHA[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para chatarra (prefijo CHA).'
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
  'retazo_reutilizable',
  'RET',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_retazo FROM 4) AS INTEGER))
      FROM aceros.retazo_reutilizable
      WHERE id_retazo ~ '^RET[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para retazo_reutilizable (prefijo RET).'
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
  'venta_chatarra',
  'VCH',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_venta_chatarra FROM 4) AS INTEGER))
      FROM aceros.venta_chatarra
      WHERE id_venta_chatarra ~ '^VCH[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para venta_chatarra (prefijo VCH).'
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
  'exportacion_datos',
  'EXP',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_exportacion FROM 4) AS INTEGER))
      FROM aceros.exportacion_datos
      WHERE id_exportacion ~ '^EXP[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para exportacion_datos (prefijo EXP).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);
