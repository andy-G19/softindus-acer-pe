-- Snapshot del requerimiento de materiales de una orden de trabajo.
--
-- Congela al crear la orden lo que la receta exige, y sirve ademas de contenedor para lo
-- realmente movido (entregado, devuelto, consumido), que es lo que llenara la fase D.
--
-- Por que congelar si la receta ya es inmutable: la inmutabilidad de la receta ya esta
-- garantizada (no hay accion de editar ordenes, y los materiales de una version quedan
-- bloqueados en cuanto existe la primera orden). Lo que NO se puede reconstruir hacia
-- atras es el costo unitario del material al momento de crear la orden:
-- material.costo_unitario_actual cambia con cada compra y no hay historial. Por eso
-- costo_unitario_registrado se captura ahora, aunque el modulo de Costeos no lo consuma
-- hasta mas adelante: si no se guarda hoy, ese dato se pierde para siempre.
--
-- La merma no tiene columna: es derivada (entregada - consumida - devuelta). Persistirla
-- crearia un valor capaz de desviarse de sus propios sumandos.
--
-- Todas las precisiones copian exactamente las de origen (detalle_receta y material) para
-- que el snapshot no trunque nada.

CREATE TABLE IF NOT EXISTS aceros.requerimiento_orden_material (
  id_requerimiento CHAR(11) NOT NULL,
  id_orden_trabajo CHAR(11) NOT NULL,
  id_material CHAR(11) NOT NULL,
  cantidad_por_unidad DECIMAL(10,2) NOT NULL,
  merma_estimada_porcentaje DECIMAL(5,2),
  unidad_medida VARCHAR(20) NOT NULL,
  tipo_consumo VARCHAR(30) NOT NULL,
  costo_unitario_registrado DECIMAL(12,2) NOT NULL,
  cantidad_requerida DECIMAL(10,2) NOT NULL,
  cantidad_entregada DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad_devuelta DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad_consumida DECIMAL(10,2) NOT NULL DEFAULT 0,
  fecha_registro TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT requerimiento_orden_material_pkey PRIMARY KEY (id_requerimiento)
);

ALTER TABLE aceros.requerimiento_orden_material
  DROP CONSTRAINT IF EXISTS fk_requerimiento_orden;

ALTER TABLE aceros.requerimiento_orden_material
  ADD CONSTRAINT fk_requerimiento_orden
  FOREIGN KEY (id_orden_trabajo)
  REFERENCES aceros.orden_trabajo (id_orden_trabajo)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE aceros.requerimiento_orden_material
  DROP CONSTRAINT IF EXISTS fk_requerimiento_material;

ALTER TABLE aceros.requerimiento_orden_material
  ADD CONSTRAINT fk_requerimiento_material
  FOREIGN KEY (id_material)
  REFERENCES aceros.material (id_material)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Un material no puede aparecer dos veces en el requerimiento de la misma orden, igual
-- que detalle_receta no admite el mismo material dos veces en una version.
CREATE UNIQUE INDEX IF NOT EXISTS uq_requerimiento_orden_material
  ON aceros.requerimiento_orden_material (id_orden_trabajo, id_material);

CREATE INDEX IF NOT EXISTS idx_requerimiento_material
  ON aceros.requerimiento_orden_material (id_material);

-- Correlativo transaccional para la tabla nueva (prefijo ROM).
-- ultimo_numero se calcula desde los IDs existentes que cumplen el patron PREFIJO + 8
-- digitos; ON CONFLICT nunca reduce el contador (GREATEST).
INSERT INTO aceros.correlativo_sistema (
  codigo_entidad,
  prefijo,
  ultimo_numero,
  descripcion
)
VALUES (
  'requerimiento_orden_material',
  'ROM',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING(id_requerimiento FROM 4) AS INTEGER))
      FROM aceros.requerimiento_orden_material
      WHERE id_requerimiento ~ '^ROM[0-9]{8}$'
    ),
    0
  ),
  'Correlativo transaccional para requerimiento_orden_material (prefijo ROM).'
)
ON CONFLICT (codigo_entidad) DO UPDATE SET
  prefijo = EXCLUDED.prefijo,
  descripcion = EXCLUDED.descripcion,
  ultimo_numero = GREATEST(aceros.correlativo_sistema.ultimo_numero, EXCLUDED.ultimo_numero);
