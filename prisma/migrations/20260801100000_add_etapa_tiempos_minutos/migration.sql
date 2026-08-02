-- Tiempos de fabricacion por unidad, en minutos, separados para operario y maquina.
--
-- Reemplazan conceptualmente a etapa_ruta.tiempo_estimado_horas, que queda OBSOLETA pero
-- NO se convierte ni se elimina en esta migracion: aquel valor representaba horas de la
-- etapa completa y estos representan minutos por unidad producida. Son magnitudes
-- distintas, no unidades distintas, asi que multiplicar por 60 corromperia el dato. Las
-- etapas existentes se recapturan a mano y la columna vieja se elimina despues.
--
-- modo_tiempo indica como se combinan ambos tiempos para calcular la duracion de la etapa:
--   simultaneo -> max(operario, maquina)   el operario atiende la maquina todo el tiempo
--   secuencial -> operario + maquina       la maquina trabaja sola tras la preparacion
-- Solo aplica cuando la etapa tiene una maquina asignada.
--
-- El tiempo de maquina vive en etapa_ruta_maquina y no en etapa_ruta porque pertenece al
-- par etapa-maquina: asi, permitir varias maquinas por etapa en el futuro no requiere
-- ninguna migracion adicional.

ALTER TABLE aceros.etapa_ruta
  ADD COLUMN IF NOT EXISTS tiempo_operario_minutos_unidad DECIMAL(10,2);

ALTER TABLE aceros.etapa_ruta
  ADD COLUMN IF NOT EXISTS modo_tiempo VARCHAR(20) NOT NULL DEFAULT 'simultaneo';

ALTER TABLE aceros.etapa_ruta
  DROP CONSTRAINT IF EXISTS chk_etapa_ruta_modo_tiempo;

ALTER TABLE aceros.etapa_ruta
  ADD CONSTRAINT chk_etapa_ruta_modo_tiempo
  CHECK (modo_tiempo IN ('simultaneo', 'secuencial'));

ALTER TABLE aceros.etapa_ruta_maquina
  ADD COLUMN IF NOT EXISTS tiempo_maquina_minutos_unidad DECIMAL(10,2);
