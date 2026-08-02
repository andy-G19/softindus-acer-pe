-- Correlativo transaccional para etapa_ruta_maquina (asignacion de maquina a etapa).
--
-- Hasta ahora la tabla no tenia correlativo porque no habia forma de crear asignaciones:
-- no existia pantalla y la tabla estaba vacia. La fase A del plan de mejora de Produccion
-- habilita la asignacion, asi que necesita su propio contador.
--
-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron PREFIJO + 8
-- digitos, para no duplicar correlativos ya emitidos.
-- ON CONFLICT nunca reduce ultimo_numero (GREATEST), para no romper una base ya en uso.

INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'etapa_ruta_maquina',
  'ERM',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_etapa_ruta_maquina FROM 4) AS INTEGER))
      FROM aceros.etapa_ruta_maquina
      WHERE id_etapa_ruta_maquina ~ '^ERM[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para etapa_ruta_maquina (prefijo ERM).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);
