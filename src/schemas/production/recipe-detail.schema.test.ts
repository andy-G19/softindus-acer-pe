import { describe, expect, it } from "vitest";

import { recipeDetailSchema } from "@/schemas/production/recipe-detail.schema";

const input = (overrides: Record<string, unknown> = {}) => ({
  id_version_receta: "VER00000001",
  id_material: "MAT00000001",
  cantidad_requerida: "2.5",
  tipo_consumo: "materia_prima",
  merma_estimada_porcentaje: "",
  observaciones: "",
  ...overrides,
});

const errors = (overrides: Record<string, unknown>) =>
  recipeDetailSchema.safeParse(input(overrides)).error?.flatten().fieldErrors;

// B3 (hallazgo 10 de la auditoria de la 10.6): la columna tiene 2 decimales, asi que
// 0.001 pasaba .positive() y la base guardaba 0.00.
describe("recipeDetailSchema", () => {
  it.each(["0.01", "0.5", "999999.99"])("acepta %s", (cantidad_requerida) => {
    expect(recipeDetailSchema.safeParse(input({ cantidad_requerida })).success).toBe(true);
  });

  it.each(["0.009", "0.001", "0", "-1", ""])("rechaza %s con su mensaje", (cantidad_requerida) => {
    expect(errors({ cantidad_requerida })).toEqual({
      cantidad_requerida: ["La cantidad requerida debe ser de al menos 0.01."],
    });
  });

  it("rechaza una cantidad demasiado alta", () => {
    expect(errors({ cantidad_requerida: "1000000" })).toEqual({
      cantidad_requerida: ["La cantidad requerida es demasiado alta."],
    });
  });

  it("un texto en la cantidad responde en espanol", () => {
    expect(errors({ cantidad_requerida: "abc" })).toEqual({
      cantidad_requerida: ["La cantidad requerida debe ser numérica."],
    });
  });

  it("campos ausentes responden en espanol", () => {
    expect(errors({ id_version_receta: null, id_material: null })).toEqual({
      id_version_receta: ["La versión de receta es obligatoria."],
      id_material: ["Seleccione un material o insumo."],
    });
  });
});
