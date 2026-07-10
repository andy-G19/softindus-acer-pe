-- Correlativo transaccional para usuario (prefijo USU, ya usado por los
-- usuarios existentes creados via prisma/seed.ts: USU00000001-3).
-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron
-- USU + 8 digitos, para no duplicar correlativos ya emitidos. ON CONFLICT
-- nunca reduce ultimo_numero (GREATEST), para no romper una base ya en uso.
INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'usuario',
  'USU',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_usuario FROM 4) AS INTEGER))
      FROM aceros.usuario
      WHERE id_usuario ~ '^USU[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para usuario (prefijo USU).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);
