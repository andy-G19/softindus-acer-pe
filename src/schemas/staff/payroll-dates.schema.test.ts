import { describe, expect, it } from "vitest";

import { operatorPaymentSchema } from "@/schemas/staff/operator-payment.schema";
import { payrollSchema } from "@/schemas/staff/payroll.schema";

// C3 de la 11.5 (D58): las fechas de la planilla y del pago pasaban por new Date sin validar. Un
// texto que no es fecha llegaba a Prisma como fecha invalida y la pagina caia a la de error; una
// fecha que no existe («2026-02-30») pasaba al 2 de marzo sin avisar (hallazgo 7). Ahora cada
// fecha debe existir, con la regla de la asistencia (hallazgo 68 de la 10.8a), y el mensaje va a
// su campo. Un POST hecho a mano puede omitir el campo: formData.get devuelve null.

type Parse = {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  };
};

function errorsOf(schema: Parse, value: Record<string, unknown>) {
  const result = schema.safeParse(value);

  return result.success
    ? {}
    : Object.fromEntries(result.error!.issues.map((issue) => [issue.path.join("."), issue.message]));
}

const payroll = {
  id_operario: "OPE00000003",
  periodo_inicio: "2026-11-02",
  periodo_fin: "2026-11-08",
  descuentos: "",
};

const payment = {
  id_planilla: "PLA00000009",
  fecha_pago: "2026-11-09",
  monto_pagado: "90.00",
  metodo_pago: "efectivo",
  observaciones: "",
};

describe("payrollSchema: fechas del periodo", () => {
  it.each(["abc", "2026-02-30", "2026-13-01", "2026-2-3"])("rechaza un inicio %s en su campo", (periodo_inicio) => {
    expect(errorsOf(payrollSchema, { ...payroll, periodo_inicio })).toEqual({
      periodo_inicio: "La fecha de inicio del periodo no es válida.",
    });
  });

  it.each(["abc", "2026-02-30", "2026-11-31"])("rechaza un fin %s en su campo", (periodo_fin) => {
    expect(errorsOf(payrollSchema, { ...payroll, periodo_fin })).toEqual({
      periodo_fin: "La fecha de fin del periodo no es válida.",
    });
  });

  it("acepta el ultimo dia de febrero y el de un mes de 31", () => {
    expect(errorsOf(payrollSchema, { ...payroll, periodo_inicio: "2026-02-28", periodo_fin: "2026-03-31" })).toEqual({});
  });

  it("responde en espanol cuando faltan las fechas", () => {
    expect(errorsOf(payrollSchema, { ...payroll, periodo_inicio: null, periodo_fin: null })).toEqual({
      periodo_inicio: "La fecha de inicio del periodo es obligatoria.",
      periodo_fin: "La fecha de fin del periodo es obligatoria.",
    });
  });

  it("sigue rechazando un fin anterior al inicio, en el campo del fin", () => {
    expect(errorsOf(payrollSchema, { ...payroll, periodo_inicio: "2026-11-08", periodo_fin: "2026-11-02" })).toEqual({
      periodo_fin: "La fecha de fin no puede ser menor que la fecha de inicio.",
    });
  });
});

describe("operatorPaymentSchema: fecha de pago", () => {
  it.each(["abc", "2026-02-30", "2026-11-9"])("rechaza %s en su campo", (fecha_pago) => {
    expect(errorsOf(operatorPaymentSchema, { ...payment, fecha_pago })).toEqual({
      fecha_pago: "La fecha de pago no es válida.",
    });
  });

  it("acepta una fecha que existe", () => {
    expect(errorsOf(operatorPaymentSchema, payment)).toEqual({});
  });

  it("responde en espanol cuando falta la fecha", () => {
    expect(errorsOf(operatorPaymentSchema, { ...payment, fecha_pago: null })).toEqual({
      fecha_pago: "La fecha de pago es obligatoria.",
    });
  });
});
