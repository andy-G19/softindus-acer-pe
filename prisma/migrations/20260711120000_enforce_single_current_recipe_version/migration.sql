-- El indice parcial unico "uq_version_receta_vigente" ya estaba definido en
-- la migracion historica 20260630190000_fix_recipe_versioning. Esa migracion
-- fue registrada en Supabase como aplicada sin ejecutar su SQL
-- (applied_steps_count = 0), por lo que el indice nunca se creo fisicamente
-- ahi, aunque si se crea al reconstruir la base desde el baseline + las 12
-- migraciones historicas en un entorno nuevo.
--
-- Esta migracion correctiva converge Supabase con una reconstruccion desde
-- cero, garantizando que el indice exista en ambos casos sin modificar la
-- migracion historica original.
--
-- prisma/schema.prisma no modela este indice: declararlo como @unique sobre
-- id_receta fuerza en Prisma Client una relacion 1:1 entre receta_tecnica y
-- version_receta, cuando el dominio real permite multiples versiones
-- historicas por receta (solo una vigente a la vez). El indice vive
-- unicamente a nivel de base de datos.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM aceros.version_receta
    WHERE estado = 'vigente'
    GROUP BY id_receta
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'No se puede crear el indice: existen varias versiones vigentes para una receta.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_version_receta_vigente
  ON aceros.version_receta (id_receta)
  WHERE estado = 'vigente';
