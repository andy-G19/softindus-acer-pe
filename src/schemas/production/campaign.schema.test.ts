import { describe, expect, it } from "vitest";

import { campaignDetailSchema, productionCampaignSchema } from "@/schemas/production/campaign.schema";

// A3 de la 10.7a: fecha que existe, cantidad que no se guarda como cero, tope de la
// columna numeric(10,2) y mensajes en espanol. Hasta ahora la accion lanzaba y Next
// ocultaba el mensaje; con el resultado de accion, el usuario los lee.

const campaign = {
  nombre_campania: "Campaña escolar",
  fecha_inicio: "2026-08-01",
  fecha_fin: "2026-08-31",
  objetivo_general: "Reponer stock",
  estado: "planificada",
};

const fieldErrors = (input: unknown) =>
  productionCampaignSchema.safeParse(input).error?.flatten().fieldErrors;

describe("productionCampaignSchema", () => {
  it("acepta una campaña valida", () => {
    expect(productionCampaignSchema.safeParse(campaign).success).toBe(true);
  });

  it("un POST sin campos responde en español", () => {
    expect(
      fieldErrors({
        nombre_campania: null,
        fecha_inicio: null,
        fecha_fin: "",
        objetivo_general: "",
        estado: null,
      }),
    ).toEqual({
      nombre_campania: ["El nombre de la campaña es obligatorio."],
      fecha_inicio: ["La fecha de inicio es obligatoria."],
      estado: ["Selecciona un estado válido."],
    });
  });

  it.each(["2026-02-30", "2026-13-01", "2026-7-5", "no-es-fecha"])("la fecha de inicio %s no existe", (fecha) => {
    expect(fieldErrors({ ...campaign, fecha_inicio: fecha, fecha_fin: "" })).toEqual({
      fecha_inicio: ["La fecha de inicio no es válida."],
    });
  });

  it.each(["2026-02-30", "2026-13-01"])("la fecha de fin %s no existe", (fecha) => {
    expect(fieldErrors({ ...campaign, fecha_fin: fecha })).toEqual({
      fecha_fin: ["La fecha de fin no es válida."],
    });
  });

  it("el 29 de febrero de un año bisiesto existe", () => {
    expect(productionCampaignSchema.safeParse({ ...campaign, fecha_inicio: "2028-02-29", fecha_fin: "" }).success).toBe(true);
  });

  it("el nombre vacio y el demasiado largo tienen mensaje en español", () => {
    expect(fieldErrors({ ...campaign, nombre_campania: " " })).toEqual({
      nombre_campania: ["El nombre de la campaña es obligatorio."],
    });
    expect(fieldErrors({ ...campaign, nombre_campania: "x".repeat(101) })).toEqual({
      nombre_campania: ["El nombre de la campaña no debe superar 100 caracteres."],
    });
  });

  it("el fin anterior al inicio marca la fecha de fin", () => {
    expect(fieldErrors({ ...campaign, fecha_fin: "2026-07-31" })).toEqual({
      fecha_fin: ["La fecha de fin no puede ser anterior a la fecha de inicio."],
    });
  });

  it("un objetivo largo sigue siendo valido: la columna es text", () => {
    expect(productionCampaignSchema.safeParse({ ...campaign, objetivo_general: "x".repeat(2000) }).success).toBe(true);
  });
});

const detail = {
  id_campania: "CAM00000003",
  id_producto: "PRO00000004",
  cantidad_objetivo: "100",
  observaciones: "",
};

const detailErrors = (input: unknown) =>
  campaignDetailSchema.safeParse(input).error?.flatten().fieldErrors;

describe("campaignDetailSchema", () => {
  it("redondea la cantidad a dos decimales", () => {
    expect(campaignDetailSchema.parse({ ...detail, cantidad_objetivo: "10.126" }).cantidad_objetivo).toBe(10.13);
  });

  it("un POST sin campos responde en español", () => {
    expect(
      detailErrors({ id_campania: null, id_producto: null, cantidad_objetivo: null, observaciones: "" }),
    ).toEqual({
      id_campania: ["La campaña es obligatoria."],
      id_producto: ["El producto es obligatorio."],
      cantidad_objetivo: ["La cantidad objetivo debe ser mayor a cero."],
    });
  });

  it.each(["0.004", "0", "-1"])("la cantidad %s no se puede guardar", (cantidad) => {
    expect(detailErrors({ ...detail, cantidad_objetivo: cantidad })).toEqual({
      cantidad_objetivo: ["La cantidad objetivo debe ser mayor a cero."],
    });
  });

  it("0.005 se redondea a 0.01 y se acepta", () => {
    expect(campaignDetailSchema.parse({ ...detail, cantidad_objetivo: "0.005" }).cantidad_objetivo).toBe(0.01);
  });

  it("la cantidad no numerica responde en español", () => {
    expect(detailErrors({ ...detail, cantidad_objetivo: "abc" })).toEqual({
      cantidad_objetivo: ["La cantidad objetivo debe ser un número."],
    });
  });

  it("el tope es el de numeric(10,2)", () => {
    expect(campaignDetailSchema.safeParse({ ...detail, cantidad_objetivo: "99999999.99" }).success).toBe(true);
    expect(detailErrors({ ...detail, cantidad_objetivo: "100000000" })).toEqual({
      cantidad_objetivo: ["La cantidad objetivo no debe superar 99,999,999.99."],
    });
  });
});
