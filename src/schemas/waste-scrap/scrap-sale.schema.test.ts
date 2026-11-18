import { describe, expect, it } from "vitest";

import { scrapSaleSchema } from "@/schemas/waste-scrap/scrap-sale.schema";

// C4 de la 11.7d (D109, hallazgo 7 de la 11.4b): cantidad_vendida y peso_vendido_kg son
// numeric(10,2). Un 0.004 pasaba por positivo y la base lo guardaba como 0.00: una venta sin peso
// ni cantidad. Se rechaza lo que redondea a cero (menos de 0.005), como en scrap.schema.ts. El
// redondeo lo sigue haciendo la base: 0.005 se guarda como 0.01.

const sale = {
  id_chatarra: "CHA00000005",
  id_caja_chica: "",
  fecha_venta: "2026-11-18",
  cantidad_vendida: "",
  peso_vendido_kg: "",
  monto_recibido: "50.00",
  destino_dinero: "",
  observaciones: "",
};

const fieldErrors = (input: unknown) => scrapSaleSchema.safeParse(input).error?.flatten().fieldErrors;

describe("scrapSaleSchema: peso y cantidad que redondean a cero", () => {
  it("rechaza un peso de 0.004", () => {
    expect(fieldErrors({ ...sale, peso_vendido_kg: "0.004" })?.peso_vendido_kg).toEqual([
      "El valor debe ser mayor que cero.",
    ]);
  });

  it("rechaza una cantidad de 0.004", () => {
    expect(fieldErrors({ ...sale, cantidad_vendida: "0.004" })?.cantidad_vendida).toEqual([
      "El valor debe ser mayor que cero.",
    ]);
  });

  it("acepta 0.005, que la base guarda como 0.01, sin redondearlo aqui", () => {
    const parsed = scrapSaleSchema.parse({ ...sale, peso_vendido_kg: "0.005", cantidad_vendida: "0.005" });

    expect(parsed.peso_vendido_kg).toBe(0.005);
    expect(parsed.cantidad_vendida).toBe(0.005);
  });

  it("un cero sigue dando el mismo mensaje", () => {
    expect(fieldErrors({ ...sale, peso_vendido_kg: "0" })?.peso_vendido_kg).toEqual([
      "El valor debe ser mayor que cero.",
    ]);
  });
});
