-- Correlativos transaccionales para los modulos Personal (Staff) y Mantenimiento.
-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron
-- PREFIJO + 8 digitos, para no duplicar correlativos ya emitidos.
-- ON CONFLICT nunca reduce ultimo_numero (GREATEST), para no romper una base ya en uso.
-- No toca los correlativos ya existentes (BIT, MVI, comerciales, inventario, produccion, costos, caja chica).
-- No incluye herramienta_epp ni asignacion_herramienta_epp: no existen acciones que generen
-- esos IDs en el codigo actual, por lo tanto no se crean correlativos para ellos.

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'operario',
  'OPE',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_operario FROM 4) AS INTEGER))
      FROM aceros.operario
      WHERE id_operario ~ '^OPE[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para operario (prefijo OPE).'
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
  'asistencia',
  'ASI',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_asistencia FROM 4) AS INTEGER))
      FROM aceros.asistencia
      WHERE id_asistencia ~ '^ASI[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para asistencia (prefijo ASI).'
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
  'planilla_pago',
  'PLA',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_planilla FROM 4) AS INTEGER))
      FROM aceros.planilla_pago
      WHERE id_planilla ~ '^PLA[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para planilla_pago (prefijo PLA).'
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
  'historial_pago_operario',
  'HPO',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_historial_pago FROM 4) AS INTEGER))
      FROM aceros.historial_pago_operario
      WHERE id_historial_pago ~ '^HPO[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para historial_pago_operario (prefijo HPO).'
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
  'tarea_operario',
  'TAR',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_tarea_operario FROM 4) AS INTEGER))
      FROM aceros.tarea_operario
      WHERE id_tarea_operario ~ '^TAR[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para tarea_operario (prefijo TAR).'
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
  'maquina',
  'MAQ',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_maquina FROM 4) AS INTEGER))
      FROM aceros.maquina
      WHERE id_maquina ~ '^MAQ[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para maquina (prefijo MAQ).'
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
  'falla_maquina',
  'FAL',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_falla FROM 4) AS INTEGER))
      FROM aceros.falla_maquina
      WHERE id_falla ~ '^FAL[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para falla_maquina (prefijo FAL).'
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
  'mantenimiento_preventivo',
  'MTP',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_mantenimiento FROM 4) AS INTEGER))
      FROM aceros.mantenimiento_preventivo
      WHERE id_mantenimiento ~ '^MTP[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para mantenimiento_preventivo (prefijo MTP).'
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
  'reparacion',
  'RPA',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_reparacion FROM 4) AS INTEGER))
      FROM aceros.reparacion
      WHERE id_reparacion ~ '^RPA[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para reparacion (prefijo RPA).'
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
  'detalle_repuesto_reparacion',
  'DRP',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_detalle_repuesto FROM 4) AS INTEGER))
      FROM aceros.detalle_repuesto_reparacion
      WHERE id_detalle_repuesto ~ '^DRP[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para detalle_repuesto_reparacion (prefijo DRP).'
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
  'repuesto',
  'REP',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_repuesto FROM 4) AS INTEGER))
      FROM aceros.repuesto
      WHERE id_repuesto ~ '^REP[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para repuesto (prefijo REP).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);
