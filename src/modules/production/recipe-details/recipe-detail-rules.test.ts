import { describe, expect, it } from "vitest";

import { getRecipeDetailEditValues } from "@/modules/production/recipe-details/recipe-detail-edit-values";
import { canEditRecipeDetails, hasUnitDrift } from "@/modules/production/recipe-details/recipe-detail-rules";

const version = (overrides: { estado?: string; receta?: string; ordenes?: number } = {}) => ({
  estado: overrides.estado ?? "vigente",
  receta_tecnica: { estado: overrides.receta ?? "activa" },
  _count: { orden_trabajo: overrides.ordenes ?? 0 },
});

describe("canEditRecipeDetails", () => {
  it("una version vigente de una receta activa y sin ordenes se corrige", () => {
    expect(canEditRecipeDetails(version())).toBe(true);
  });

  it.each([
    ["reemplazada", version({ estado: "reemplazada" })],
    ["anulada", version({ estado: "anulada" })],
    ["de una receta inactiva", version({ receta: "inactiva" })],
    ["usada por ordenes", version({ ordenes: 1 })],
  ])("una version %s no se corrige", (_name, row) => {
    expect(canEditRecipeDetails(row)).toBe(false);
  });
});

describe("hasUnitDrift", () => {
  it("no distingue mayusculas ni espacios", () => {
    expect(hasUnitDrift(" KG ", "kg")).toBe(false);
  });

  it("detecta otra unidad", () => {
    expect(hasUnitDrift("gl", "kg")).toBe(true);
  });
});

describe("getRecipeDetailEditValues", () => {
  const detail = {
    id_detalle_receta: "DRE00000007",
    id_material: "MAT00000001",
    cantidad_requerida: "2.50",
    merma_estimada_porcentaje: "5.00",
    tipo_consumo: "consumible",
    observaciones: "Dos manos",
  };

  it("quita los ceros de los decimales", () => {
    expect(getRecipeDetailEditValues(detail)).toEqual({
      ...detail,
      cantidad_requerida: "2.5",
      merma_estimada_porcentaje: "5",
    });
  });

  it("una merma sin dato y sin observaciones abren vacias", () => {
    expect(getRecipeDetailEditValues({ ...detail, merma_estimada_porcentaje: null, observaciones: null })).toMatchObject({
      merma_estimada_porcentaje: "",
      observaciones: "",
    });
  });
});
