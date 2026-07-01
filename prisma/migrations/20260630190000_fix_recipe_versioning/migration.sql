-- Permite multiples versiones historicas por receta y mantiene solo una vigente.
-- Prisma no debe modelar este indice parcial como @unique en id_receta porque
-- eso fuerza una relacion 1:1 en el cliente generado.
ALTER TABLE aceros.version_receta
  DROP CONSTRAINT IF EXISTS uq_version_receta_vigente;

DROP INDEX IF EXISTS aceros.uq_version_receta_vigente;

CREATE UNIQUE INDEX uq_version_receta_vigente
  ON aceros.version_receta (id_receta)
  WHERE estado = 'vigente';
