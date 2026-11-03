import { describe, expect, it } from "vitest";

import { scrapSchema } from "@/schemas/waste-scrap/scrap.schema";

// A9 de la 10.7a: peso_kg y cantidad son numeric(10,2). Un valor que se redondea a cero
// dejaba un registro sin peso ni cantidad, y uno mayor que la columna daba un error 500.

const scrap = {
  id_material: "MAT00000002",
  id_orden_trabajo: "OTR00000003",
  tipo_material: "Acero",
  peso_kg: "12.5",
  cantidad: "3",
  observaciones: "",
};

const fieldErrors = (input: unknown) => scrapSchema.safeParse(input).error?.flatten().fieldErrors;

describe("scrapSchema", () => {
  it("no redondea: lo hace la base, y 3.005 se guarda como 3.01", () => {
    const parsed = scrapSchema.parse({ ...scrap, peso_kg: "12.126", cantidad: "3.005" });

    expect(parsed.peso_kg).toBe(12.126);
    expect(parsed.cantidad).toBe(3.005);
  });

  it("0.005 se acepta: la base lo guarda como 0.01", () => {
    expect(scrapSchema.parse({ ...scrap, peso_kg: "0.005", cantidad: "" }).peso_kg).toBe(0.005);
  });

  it("un POST sin campos responde en español", () => {
    expect(
      fieldErrors({
        id_material: null,
        id_orden_trabajo: null,
        tipo_material: null,
        peso_kg: null,
        cantidad: null,
        observaciones: null,
      }),
    ).toEqual({ tipo_material: ["El tipo de material es obligatorio."] });
  });

  it("sin peso ni cantidad pide al menos uno", () => {
    expect(fieldErrors({ ...scrap, peso_kg: "", cantidad: "" })).toEqual({
      peso_kg: ["Debe registrar al menos peso en kg o cantidad aproximada."],
    });
  });

  it.each(["0.001", "0", "-1"])("el peso %s no se puede guardar y solo da su mensaje", (peso) => {
    expect(fieldErrors({ ...scrap, peso_kg: peso, cantidad: "" })).toEqual({
      peso_kg: ["El valor debe ser mayor que cero."],
    });
  });

  it("una cantidad que se redondea a cero marca su campo", () => {
    expect(fieldErrors({ ...scrap, cantidad: "0.004" })).toEqual({
      cantidad: ["El valor debe ser mayor que cero."],
    });
  });

  it("el tope es el de numeric(10,2)", () => {
    expect(scrapSchema.safeParse({ ...scrap, peso_kg: "99999999.99" }).success).toBe(true);
    expect(fieldErrors({ ...scrap, peso_kg: "100000000" })).toEqual({
      peso_kg: ["El valor no debe superar 99,999,999.99."],
    });
  });

  it("un valor no numerico responde en español", () => {
    expect(fieldErrors({ ...scrap, peso_kg: "abc" })).toEqual({ peso_kg: ["El valor debe ser numérico."] });
  });
});
