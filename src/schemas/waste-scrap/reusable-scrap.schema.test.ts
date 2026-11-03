import { describe, expect, it } from "vitest";

import { reusableScrapSchema } from "@/schemas/waste-scrap/reusable-scrap.schema";
import { reusableScrapStatusSchema } from "@/schemas/waste-scrap/reusable-scrap-status.schema";

// A9 de la 10.7a: cantidad es numeric(10,2). Un valor que se redondea a cero dejaba un
// retazo sin cantidad, y uno mayor que la columna daba un error 500.

const scrap = {
  id_material: "MAT00000002",
  id_orden_trabajo: "OTR00000003",
  medida_aproximada: "",
  cantidad: "2",
  unidad_medida: "pieza",
  ubicacion: "",
};

const fieldErrors = (input: unknown) => reusableScrapSchema.safeParse(input).error?.flatten().fieldErrors;

describe("reusableScrapSchema", () => {
  it("no redondea: lo hace la base, y 3.005 se guarda como 3.01", () => {
    expect(reusableScrapSchema.parse({ ...scrap, cantidad: "3.005" }).cantidad).toBe(3.005);
  });

  it("0.005 se acepta: la base lo guarda como 0.01", () => {
    expect(reusableScrapSchema.parse({ ...scrap, cantidad: "0.005" }).cantidad).toBe(0.005);
  });

  it("un POST sin campos responde en español", () => {
    expect(
      fieldErrors({
        id_material: null,
        id_orden_trabajo: null,
        medida_aproximada: null,
        cantidad: null,
        unidad_medida: null,
        ubicacion: null,
      }),
    ).toEqual({
      id_material: ["Debe seleccionar un material de origen."],
      id_orden_trabajo: ["Debe seleccionar la orden de trabajo que generó el retazo."],
      cantidad: ["La cantidad debe ser mayor que cero."],
      unidad_medida: ["La unidad de medida es obligatoria."],
    });
  });

  it.each(["0.004", "0", "-1"])("la cantidad %s no se puede guardar", (cantidad) => {
    expect(fieldErrors({ ...scrap, cantidad })).toEqual({ cantidad: ["La cantidad debe ser mayor que cero."] });
  });

  it("el tope es el de numeric(10,2)", () => {
    expect(reusableScrapSchema.safeParse({ ...scrap, cantidad: "99999999.99" }).success).toBe(true);
    expect(fieldErrors({ ...scrap, cantidad: "100000000" })).toEqual({
      cantidad: ["La cantidad no debe superar 99,999,999.99."],
    });
  });

  it("una cantidad no numerica responde en español", () => {
    expect(fieldErrors({ ...scrap, cantidad: "abc" })).toEqual({ cantidad: ["La cantidad debe ser numérica."] });
  });
});

describe("reusableScrapStatusSchema", () => {
  it("un POST sin campos responde en español", () => {
    expect(reusableScrapStatusSchema.safeParse({ id_retazo: null, estado: null }).error?.flatten().fieldErrors).toEqual({
      id_retazo: ["Debe seleccionar un retazo."],
      estado: ["Debe seleccionar un estado válido para el retazo."],
    });
  });
});
