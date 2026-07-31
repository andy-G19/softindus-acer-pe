-- Relaciona la chatarra generada con la orden de trabajo que la produjo.
--
-- La columna es NULLABLE a proposito: la chatarra tambien puede originarse
-- fuera de una orden (limpieza de taller, sobrantes de compra, desmontajes),
-- y los registros historicos no tienen forma de saber a que orden pertenecen.
-- El formulario ofrece el selector, pero no lo exige.
--
-- ON DELETE RESTRICT sigue la misma convencion que fk_retazo_orden: no se
-- borra una orden de trabajo que ya dejo rastro de chatarra.

ALTER TABLE aceros.chatarra
  ADD COLUMN IF NOT EXISTS id_orden_trabajo CHAR(11);

ALTER TABLE aceros.chatarra
  DROP CONSTRAINT IF EXISTS fk_chatarra_orden;

ALTER TABLE aceros.chatarra
  ADD CONSTRAINT fk_chatarra_orden
  FOREIGN KEY (id_orden_trabajo)
  REFERENCES aceros.orden_trabajo (id_orden_trabajo)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chatarra_orden
  ON aceros.chatarra (id_orden_trabajo);
