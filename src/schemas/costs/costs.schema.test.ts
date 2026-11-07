import { describe, expect, it } from "vitest";

import { indirectCostSchema } from "@/schemas/costs/indirect-cost.schema";
import { laborCostSchema } from "@/schemas/costs/labor-cost.schema";
import { marginSchema } from "@/schemas/costs/margin.schema";

// Hallazgos 66 y 72 (10.8): un monto vacio se convertia en 0, no habia maximo para
// Decimal(12, 2) y el precio final no numerico respondia «Invalid input». Estas pruebas
// fijan los rechazos con su mensaje en espanol.

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.message);
}

const COSTEO = "COS00000004";

describe("mano de obra", () => {
  const parse = (costo_mano_obra: unknown) =>
    laborCostSchema.safeParse({ id_costeo: COSTEO, costo_mano_obra });

  it.each([
    { motivo: "vacia", valor: "", mensaje: "El costo de mano de obra es obligatorio." },
    { motivo: "solo espacios", valor: "   ", mensaje: "El costo de mano de obra es obligatorio." },
    { motivo: "sin el campo", valor: null, mensaje: "El costo de mano de obra es obligatorio." },
    { motivo: "no numerica", valor: "abc", mensaje: "El costo de mano de obra debe ser numérico." },
    { motivo: "negativa", valor: "-1", mensaje: "El costo de mano de obra no puede ser negativo." },
    {
      motivo: "sobre el maximo de la columna",
      valor: "10000000000",
      mensaje: "El costo de mano de obra no debe superar S/ 9,999,999,999.99.",
    },
  ])("rechaza la mano de obra $motivo", ({ valor, mensaje }) => {
    expect(messages(parse(valor))).toEqual([mensaje]);
  });

  it.each([
    { valor: "0", esperado: 0 },
    { valor: "180.5", esperado: 180.5 },
    { valor: "9999999999.99", esperado: 9999999999.99 },
  ])("acepta $valor", ({ valor, esperado }) => {
    const result = parse(valor);

    expect(result.success).toBe(true);
    expect(result.data?.costo_mano_obra).toBe(esperado);
  });

  it("sin costeo responde en espanol", () => {
    expect(messages(laborCostSchema.safeParse({ id_costeo: null, costo_mano_obra: "1" }))).toEqual([
      "El costeo es obligatorio.",
    ]);
  });
});

describe("costo indirecto", () => {
  const form = {
    id_costeo: COSTEO,
    concepto: "Consumo de luz del lote",
    categoria: "luz",
    monto: "37.80",
    criterio_prorrateo: "",
    periodo: "",
    observaciones: "",
  };
  const parse = (changes: Record<string, unknown>) => indirectCostSchema.safeParse({ ...form, ...changes });

  it.each([
    { motivo: "vacio", valor: "", mensaje: "El monto es obligatorio." },
    { motivo: "sin el campo", valor: null, mensaje: "El monto es obligatorio." },
    { motivo: "no numerico", valor: "abc", mensaje: "El monto debe ser numérico." },
    { motivo: "negativo", valor: "-1", mensaje: "El monto no puede ser negativo." },
    {
      motivo: "sobre el maximo de la columna",
      valor: "10000000000",
      mensaje: "El monto no debe superar S/ 9,999,999,999.99.",
    },
  ])("rechaza el monto $motivo", ({ valor, mensaje }) => {
    expect(messages(parse({ monto: valor }))).toEqual([mensaje]);
  });

  it("acepta un monto de cero y el maximo", () => {
    expect(parse({ monto: "0" }).data?.monto).toBe(0);
    expect(parse({ monto: "9999999999.99" }).data?.monto).toBe(9999999999.99);
  });

  it("sin concepto responde en espanol", () => {
    expect(messages(parse({ concepto: null }))).toEqual(["El concepto es obligatorio."]);
  });
});

describe("margen", () => {
  const form = { id_costeo: COSTEO, porcentaje_margen: "17", precio_final: "", motivo_ajuste: "" };
  const parse = (changes: Record<string, unknown>) => marginSchema.safeParse({ ...form, ...changes });

  it.each([
    { motivo: "vacio", valor: "", mensaje: "El porcentaje de margen es obligatorio." },
    { motivo: "sin el campo", valor: null, mensaje: "El porcentaje de margen es obligatorio." },
    { motivo: "no numerico", valor: "abc", mensaje: "El porcentaje de margen debe ser numérico." },
    { motivo: "bajo el minimo", valor: "14.99", mensaje: "El margen mínimo permitido es 15%." },
    { motivo: "sobre el maximo", valor: "20.01", mensaje: "El margen máximo permitido es 20%." },
  ])("rechaza el porcentaje $motivo", ({ valor, mensaje }) => {
    expect(messages(parse({ porcentaje_margen: valor }))).toEqual([mensaje]);
  });

  it.each([
    { motivo: "no numerico", valor: "abc", mensaje: "El precio final debe ser numérico." },
    { motivo: "negativo", valor: "-1", mensaje: "El precio final no puede ser negativo." },
    {
      motivo: "sobre el maximo de la columna",
      valor: "10000000000",
      mensaje: "El precio final no debe superar S/ 9,999,999,999.99.",
    },
  ])("rechaza el precio final $motivo", ({ valor, mensaje }) => {
    expect(messages(parse({ precio_final: valor }))).toEqual([mensaje]);
  });

  it.each([
    { motivo: "vacio", valor: "" },
    { motivo: "solo espacios", valor: "  " },
    { motivo: "sin el campo", valor: null },
  ])("sin precio final ($motivo) usa el sugerido: queda en null", ({ valor }) => {
    const result = parse({ precio_final: valor });

    expect(result.success).toBe(true);
    expect(result.data?.precio_final).toBeNull();
  });

  it("conserva el precio final escrito", () => {
    expect(parse({ precio_final: "1800" }).data?.precio_final).toBe(1800);
  });
});
