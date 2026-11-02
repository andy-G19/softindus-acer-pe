import { describe, expect, it } from "vitest";

import { buildRecipeMaterialOptions } from "@/modules/production/recipe-details/recipe-material-options";

const MATERIAL = {
  id_material: "MAT00000001",
  nombre_material: "Plancha de acero",
  categoria: "insumos",
  unidad_medida: "kg",
  stock_actual: "12.5",
  costo_unitario_actual: "10",
};

describe("buildRecipeMaterialOptions", () => {
  it("describe la categoria, el stock y el costo", () => {
    expect(buildRecipeMaterialOptions([MATERIAL])).toEqual([
      {
        id: "MAT00000001",
        label: "Plancha de acero",
        description: "insumos - Stock: 12.50 kg - S/ 10.00",
        unidad_medida: "kg",
      },
    ]);
  });

  it("un material activo no lleva marca", () => {
    const [option] = buildRecipeMaterialOptions([{ ...MATERIAL, estado: true }]);

    expect(option.description).not.toContain("Inactivo");
  });

  it("marca el material inactivo", () => {
    const [option] = buildRecipeMaterialOptions([{ ...MATERIAL, estado: false }]);

    expect(option.description).toBe("insumos - Stock: 12.50 kg - S/ 10.00 - Inactivo");
  });
});
