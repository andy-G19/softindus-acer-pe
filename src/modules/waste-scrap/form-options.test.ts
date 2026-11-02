import { describe, expect, it } from "vitest";

import { buildMaterialItems, buildWorkOrderItems } from "@/modules/waste-scrap/form-options";

// Las opciones no salen en el HTML del servidor: SearchableSelect las pinta al abrirse.

describe("opciones de Mermas", () => {
  it("el material muestra su categoria y su stock", () => {
    expect(
      buildMaterialItems([
        {
          id_material: "MAT00000002",
          nombre_material: "Plancha",
          categoria: "planchas",
          stock_actual: "10.50",
          unidad_medida: "kg",
        },
      ]),
    ).toEqual([{ id: "MAT00000002", label: "Plancha", description: "planchas - Stock: 10.50 kg" }]);
  });

  it("la orden muestra su producto, su estado y su cliente", () => {
    expect(
      buildWorkOrderItems([
        {
          id_orden_trabajo: "OTR00000003",
          estado: "en_proceso",
          producto: { nombre_producto: "Lampa" },
          cliente: { nombre_razon_social: "Ferreteria Lima" },
        },
      ]),
    ).toEqual([{ id: "OTR00000003", label: "OTR00000003 - Lampa", description: "en_proceso - Ferreteria Lima" }]);
  });

  it("una orden sin cliente solo muestra su estado", () => {
    expect(
      buildWorkOrderItems([
        {
          id_orden_trabajo: "OTR00000004",
          estado: "pendiente",
          producto: { nombre_producto: "Pico" },
          cliente: null,
        },
      ]),
    ).toEqual([{ id: "OTR00000004", label: "OTR00000004 - Pico", description: "pendiente" }]);
  });
});
