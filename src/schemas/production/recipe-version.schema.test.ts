import { describe, expect, it } from "vitest";

import { recipeVersionSchema, recipeVersionStatusSchema } from "@/schemas/production/recipe-version.schema";

const line = (overrides: Record<string, unknown> = {}) => ({
  id_material: "MAT00000001",
  cantidad_requerida: "2.5",
  tipo_consumo: "materia_prima",
  merma_estimada_porcentaje: "0",
  observaciones: "",
  ...overrides,
});

const input = (overrides: Record<string, unknown> = {}) => ({
  id_receta: "REC00000001",
  numero_version: "",
  motivo_cambio: "",
  detalles: [line()],
  ...overrides,
});

const messages = (overrides: Record<string, unknown>) =>
  recipeVersionSchema.safeParse(input(overrides)).error?.issues.map((issue) => issue.message);

// B3 (hallazgo 10 de la auditoria de la 10.6): la misma regla de cantidad que una
// linea suelta, y mensajes en espanol para lo que llega sin campo.
describe("recipeVersionSchema", () => {
  it("acepta 0.01", () => {
    expect(recipeVersionSchema.safeParse(input({ detalles: [line({ cantidad_requerida: "0.01" })] })).success).toBe(true);
  });

  it("rechaza 0.001 con su mensaje", () => {
    expect(messages({ detalles: [line({ cantidad_requerida: "0.001" })] })).toEqual([
      "La cantidad requerida debe ser de al menos 0.01.",
    ]);
  });

  it("un texto en la cantidad responde en espanol", () => {
    expect(messages({ detalles: [line({ cantidad_requerida: "abc" })] })).toEqual([
      "La cantidad requerida debe ser numérica.",
    ]);
  });

  it("sin receta responde en espanol", () => {
    expect(messages({ id_receta: null })).toEqual(["La receta técnica es obligatoria."]);
  });
});

describe("recipeVersionSchema: materiales repetidos", () => {
  const withMaterials = (...ids: string[]) =>
    recipeVersionSchema.safeParse({
      id_receta: "REC00000001",
      detalles: ids.map((id_material) => ({
        id_material,
        cantidad_requerida: "1",
        tipo_consumo: "consumible",
        merma_estimada_porcentaje: "0",
      })),
    });
  const repeatedPaths = (result: ReturnType<typeof withMaterials>) =>
    result.error?.issues
      .filter((issue) => issue.message === "No se permite duplicar materiales dentro de la versión.")
      .map((issue) => issue.path.join("."));

  it("marca cada linea que lo usa, no solo la segunda", () => {
    expect(repeatedPaths(withMaterials("MAT00000001", "MAT00000002", "MAT00000001"))).toEqual([
      "detalles.0.id_material",
      "detalles.2.id_material",
    ]);
  });

  it("dos lineas vacias no cuentan como repetidas", () => {
    expect(repeatedPaths(withMaterials("", ""))).toEqual([]);
  });
});

describe("recipeVersionStatusSchema", () => {
  it("campos ausentes responden en espanol", () => {
    const parsed = recipeVersionStatusSchema.safeParse({ id_receta: null, id_version_receta: null });

    expect(parsed.error?.issues.map((issue) => issue.message)).toEqual([
      "La receta técnica es obligatoria.",
      "La versión de receta es obligatoria.",
    ]);
  });
});
