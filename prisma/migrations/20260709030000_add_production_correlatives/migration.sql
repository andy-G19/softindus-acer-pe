-- Correlativos transaccionales para el modulo produccion.
-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron
-- PREFIJO + 8 digitos, para no duplicar correlativos ya emitidos.
-- ON CONFLICT nunca reduce ultimo_numero (GREATEST), para no romper una base ya en uso.
-- No toca los correlativos ya existentes (BIT, MVI, ALE, comerciales, inventario).

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'ruta_fabricacion',
  'RUT',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_ruta FROM 4) AS INTEGER))
      FROM aceros.ruta_fabricacion
      WHERE id_ruta ~ '^RUT[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para ruta_fabricacion (prefijo RUT).'
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
  'etapa_ruta',
  'ETA',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_etapa_ruta FROM 4) AS INTEGER))
      FROM aceros.etapa_ruta
      WHERE id_etapa_ruta ~ '^ETA[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para etapa_ruta (prefijo ETA).'
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
  'receta_tecnica',
  'REC',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_receta FROM 4) AS INTEGER))
      FROM aceros.receta_tecnica
      WHERE id_receta ~ '^REC[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para receta_tecnica (prefijo REC).'
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
  'version_receta',
  'VER',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_version_receta FROM 4) AS INTEGER))
      FROM aceros.version_receta
      WHERE id_version_receta ~ '^VER[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para version_receta (prefijo VER).'
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
  'detalle_receta',
  'DRE',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_detalle_receta FROM 4) AS INTEGER))
      FROM aceros.detalle_receta
      WHERE id_detalle_receta ~ '^DRE[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para detalle_receta (prefijo DRE).'
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
  'orden_trabajo',
  'OTR',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_orden_trabajo FROM 4) AS INTEGER))
      FROM aceros.orden_trabajo
      WHERE id_orden_trabajo ~ '^OTR[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para orden_trabajo (prefijo OTR).'
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
  'avance_orden',
  'AVN',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_avance FROM 4) AS INTEGER))
      FROM aceros.avance_orden
      WHERE id_avance ~ '^AVN[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para avance_orden (prefijo AVN).'
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
  'campania_produccion',
  'CAM',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_campania FROM 4) AS INTEGER))
      FROM aceros.campania_produccion
      WHERE id_campania ~ '^CAM[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para campania_produccion (prefijo CAM).'
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
  'campania_detalle',
  'CPD',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_campania_detalle FROM 4) AS INTEGER))
      FROM aceros.campania_detalle
      WHERE id_campania_detalle ~ '^CPD[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para campania_detalle (prefijo CPD).'
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
  'reasignacion_tarea',
  'REA',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_reasignacion FROM 4) AS INTEGER))
      FROM aceros.reasignacion_tarea
      WHERE id_reasignacion ~ '^REA[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para reasignacion_tarea (prefijo REA).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);
