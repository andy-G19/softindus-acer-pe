import { describe, expect, it } from "vitest";

import {
  repairSchema,
  repairSparePartSchema,
  repairStatusSchema,
} from "@/schemas/maintenance/repair.schema";

/**
 * Validacion de reparaciones (entrega 10.5b): mensajes en espanol, ninguno con
 * el texto por defecto de Zod, fechas que existen, importes dentro de sus
 * columnas y lineas de repuesto completas. Los valores llegan como los arma la
 * accion: null si un campo obligatorio no viene (formData.get); los opcionales
 * y las ranuras de repuesto tienen valor por defecto.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    id_falla: "FAL00000007",
    fecha_reparacion: "2026-07-16",
    tecnico_proveedor: "",
    mano_obra: "",
    estado_reparacion: "programada",
    observaciones: "",
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = repairSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

function lineErrors(input: Record<string, unknown>) {
  const parsed = repairSparePartSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;
const INVALID_LABOR = { mano_obra: ["La mano de obra debe ser un número válido."] };
const MAX_LABOR = { mano_obra: ["La mano de obra no debe superar S/ 9,999,999,999.99."] };
const INVALID_QUANTITY = { cantidad: ["La cantidad del repuesto debe ser un número válido."] };
const ZERO_QUANTITY = { cantidad: ["La cantidad del repuesto debe ser mayor a cero."] };
const MAX_QUANTITY = { cantidad: ["La cantidad del repuesto no debe superar 99,999,999.99."] };

describe("repairSchema", () => {
  it("acepta una reparacion valida y deja la fecha en la medianoche del proceso", () => {
    const parsed = repairSchema.parse(buildInput());

    expect(parsed.fecha_reparacion).toEqual(new Date("2026-07-16T00:00:00"));
  });

  it("los obligatorios ausentes dan su mensaje en espanol", () => {
    expect(fieldErrors({ id_falla: null, fecha_reparacion: null, estado_reparacion: null })).toEqual({
      id_falla: ["Seleccione una falla válida."],
      fecha_reparacion: ["La fecha de reparación es obligatoria."],
      estado_reparacion: ["Seleccione un estado de reparación válido."],
    });
  });

  it("ningun mensaje es el de Zod", () => {
    const errors = fieldErrors({}) ?? {};

    expect(Object.values(errors).flat().join(" ")).not.toMatch(ZOD_DEFAULT);
  });

  it("una fecha vacia solo dice que es obligatoria", () => {
    expect(fieldErrors(buildInput({ fecha_reparacion: "" }))).toEqual({
      fecha_reparacion: ["La fecha de reparación es obligatoria."],
    });
  });

  it.each(["2026-02-30", "2026-13-01", "2026-7-5", "mañana"])("rechaza la fecha %s", (fecha_reparacion) => {
    expect(fieldErrors(buildInput({ fecha_reparacion }))).toEqual({
      fecha_reparacion: ["La fecha de reparación no es válida."],
    });
  });

  it.each([
    ["", null],
    ["150.50", null],
    ["9999999999.99", null],
    ["9999999999.995", MAX_LABOR],
    ["1e12", MAX_LABOR],
    ["-5", { mano_obra: ["La mano de obra no puede ser negativa."] }],
    ["abc", INVALID_LABOR],
    ["0x10", INVALID_LABOR],
    ["Infinity", INVALID_LABOR],
  ])("mano de obra %s", (mano_obra, errors) => {
    expect(fieldErrors(buildInput({ mano_obra }))).toEqual(errors);
  });
});

describe("repairSparePartSchema", () => {
  it("una ranura vacia es valida", () => {
    expect(repairSparePartSchema.parse({ id_repuesto: "", cantidad: "" })).toEqual({
      id_repuesto: "",
      cantidad: null,
    });
  });

  it("repuesto sin cantidad pide la cantidad", () => {
    expect(lineErrors({ id_repuesto: "REP00000001", cantidad: "" })).toEqual({
      cantidad: ["Ingrese la cantidad del repuesto."],
    });
  });

  it("cantidad sin repuesto pide el repuesto", () => {
    expect(lineErrors({ id_repuesto: "", cantidad: "2" })).toEqual({
      id_repuesto: ["Seleccione el repuesto."],
    });
  });

  it.each([
    ["1.25", null],
    ["0.01", null],
    ["0.005", null],
    ["99999999.99", null],
    ["0", ZERO_QUANTITY],
    ["-1", ZERO_QUANTITY],
    ["0.001", ZERO_QUANTITY],
    ["99999999.995", MAX_QUANTITY],
    ["1e9", MAX_QUANTITY],
    ["dos", INVALID_QUANTITY],
    ["0x10", INVALID_QUANTITY],
  ])("cantidad %s", (cantidad, errors) => {
    expect(lineErrors({ id_repuesto: "REP00000001", cantidad })).toEqual(errors);
  });
});

describe("repairStatusSchema", () => {
  it("un POST sin campos da sus mensajes en espanol", () => {
    const parsed = repairStatusSchema.safeParse({ id_reparacion: null, estado_reparacion: null });

    expect(parsed.success ? null : parsed.error.flatten().fieldErrors).toEqual({
      id_reparacion: ["El identificador de la reparación no es válido."],
      estado_reparacion: ["Seleccione un estado de reparación válido."],
    });
  });
});
