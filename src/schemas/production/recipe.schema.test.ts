import { describe, expect, it } from "vitest";

import { technicalRecipeSchema } from "@/schemas/production/recipe.schema";

// B3 (hallazgo 10 de la auditoria de la 10.6): un POST sin campos llega con null,
// y sin mensaje propio Zod respondia en ingles.
describe("technicalRecipeSchema", () => {
  it("un POST sin campos responde en espanol", () => {
    const parsed = technicalRecipeSchema.safeParse({ id_producto: null, nombre_receta: null, descripcion: "" });

    expect(parsed.error?.flatten().fieldErrors).toEqual({
      id_producto: ["Seleccione un producto."],
      nombre_receta: ["El nombre de la receta debe tener al menos 3 caracteres."],
    });
  });
});
