-- Claves de idempotencia de las operaciones (entrega 11.1).
--
-- El formulario genera una clave (UUID) antes de enviar y la accion la reclama
-- como primera instruccion de su transaccion, con INSERT ... ON CONFLICT DO
-- NOTHING. Si la clave ya existia, el envio es un reenvio de la misma
-- operacion y la accion responde con el resultado guardado sin volver a
-- escribir. La tabla es generica: tipo_operacion distingue cada caso de uso.
--
-- Tabla tecnica, como login_attempt: la clave no usa correlativo_sistema.
-- id_registro_resultado no tiene FK porque el resultado puede ser de cualquier
-- tabla. El indice por fecha permite limpiar las claves viejas.
--
-- Solo crea objetos nuevos: no toca datos existentes.

CREATE TABLE IF NOT EXISTS aceros.operacion_idempotente (
  clave UUID NOT NULL,
  tipo_operacion VARCHAR(60) NOT NULL,
  id_usuario CHAR(11) NOT NULL,
  id_registro_resultado CHAR(11),
  fecha_registro TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT operacion_idempotente_pkey PRIMARY KEY (clave)
);

CREATE INDEX IF NOT EXISTS idx_operacion_idempotente_fecha
  ON aceros.operacion_idempotente (fecha_registro);

ALTER TABLE aceros.operacion_idempotente
  ADD CONSTRAINT fk_operacion_idempotente_usuario
  FOREIGN KEY (id_usuario) REFERENCES aceros.usuario (id_usuario)
  ON DELETE RESTRICT ON UPDATE CASCADE;
