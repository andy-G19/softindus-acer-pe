import { describe, expect, it } from "vitest";

import { buildRouteProductOptions } from "@/modules/production/routes/route-product-options";

const ACTIVE = { id_producto: "PRO00000001", nombre_producto: "Lampa", categoria: "herramientas", unidad_medida: "unidad" };
const INACTIVE = { id_producto: "PRO00000099", nombre_producto: "Pico antiguo", categoria: "herramientas", unidad_medida: "unidad" };

describe("buildRouteProductOptions", () => {
  it("el alta ofrece los activos, sin marca", () => {
    expect(buildRouteProductOptions([ACTIVE])).toEqual([
      { id: "PRO00000001", label: "Lampa", description: "herramientas - unidad" },
    ]);
  });

  it("un producto actual activo no se repite", () => {
    expect(buildRouteProductOptions([ACTIVE], ACTIVE)).toHaveLength(1);
  });

  it("el producto actual inactivo se suma al final, marcado", () => {
    expect(buildRouteProductOptions([ACTIVE], INACTIVE)).toEqual([
      { id: "PRO00000001", label: "Lampa", description: "herramientas - unidad" },
      { id: "PRO00000099", label: "Pico antiguo", description: "herramientas - unidad - Inactivo" },
    ]);
  });
});
