-- Cierre de materiales de la orden de trabajo y acotado de tipo_movimiento.
--
-- cantidad_producida: unidades realmente fabricadas. Sin este dato no hay forma de
-- comparar lo planificado con lo producido, que era uno de los huecos originales del
-- modulo.
--
-- fecha_cierre_materiales: marca que la conciliacion de materiales ya se declaro. No se
-- deduce de cantidad_consumida > 0 porque consumir cero es un cierre valido: se entrego
-- material y volvio entero al almacen. Ambas columnas son nullable: las ordenes existentes
-- quedan con la conciliacion abierta, que es su estado real.
--
-- CHECK sobre tipo_movimiento: la columna es VARCHAR(30) libre. Verificado antes de
-- escribir esta migracion que las unicas escrituras en el codigo son 'entrada' (stock
-- inicial de material y compras) y 'salida' (consumo de orden y reversion de compra
-- anulada). La fase D agrega 'devolucion'. Sin la restriccion, un 'devolución' con tilde
-- escrito por error romperia las consultas en silencio, sin fallar en ningun sitio.
--
-- IMPORTANTE antes de aplicar en otro entorno: confirmar que no existan otros valores.
--   SELECT DISTINCT tipo_movimiento FROM aceros.movimiento_inventario;
-- Si aparece cualquier valor fuera de los tres, el ALTER falla y no aplica nada.

ALTER TABLE aceros.orden_trabajo
  ADD COLUMN IF NOT EXISTS cantidad_producida DECIMAL(10,2);

ALTER TABLE aceros.orden_trabajo
  ADD COLUMN IF NOT EXISTS fecha_cierre_materiales TIMESTAMPTZ(6);

ALTER TABLE aceros.movimiento_inventario
  DROP CONSTRAINT IF EXISTS chk_movimiento_inventario_tipo;

ALTER TABLE aceros.movimiento_inventario
  ADD CONSTRAINT chk_movimiento_inventario_tipo
  CHECK (tipo_movimiento IN ('entrada', 'salida', 'devolucion'));
