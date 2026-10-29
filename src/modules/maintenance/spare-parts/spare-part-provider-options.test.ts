import { describe, expect, it } from "vitest";

import { buildSparePartProviderOptions } from "@/modules/maintenance/spare-parts/spare-part-provider-options";

describe("buildSparePartProviderOptions", () => {
  it("marca como Inactivo solo al proveedor inactivo y conserva el orden", () => {
    expect(
      buildSparePartProviderOptions([
        { id_proveedor: "PVE00000001", razon_social: "Aceros Arequipa", estado: true },
        { id_proveedor: "PVE00000009", razon_social: "Ferreteria El Perno", estado: false },
      ]),
    ).toEqual([
      { id: "PVE00000001", label: "Aceros Arequipa" },
      { id: "PVE00000009", label: "Ferreteria El Perno", description: "Inactivo" },
    ]);
  });

  it("sin proveedores devuelve una lista vacia", () => {
    expect(buildSparePartProviderOptions([])).toEqual([]);
  });
});
