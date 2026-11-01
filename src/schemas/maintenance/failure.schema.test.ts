import { describe, expect, it } from "vitest";

import { failureSchema, failureStatusSchema } from "@/schemas/maintenance/failure.schema";

/**
 * Validacion de fallas (entrega 10.5b): mensajes en espanol, ninguno con el
 * texto por defecto de Zod, fechas que existen y el tiempo perdido dentro de
 * su columna. Los valores llegan como los arma la accion: null si un campo
 * obligatorio no viene (formData.get); los opcionales tienen valor por defecto.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    id_maquina: "MAQ00000003",
    fecha_falla: "2026-07-14T09:30",
    descripcion: "El husillo vibra",
    responsable_registro: "",
    estado_atencion: "pendiente",
    tiempo_perdido_horas: "",
    impacto_produccion: "",
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = failureSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;
const INVALID_DATE = { fecha_falla: ["La fecha de la falla no es válida."] };
const MAX_HOURS_MESSAGE = { tiempo_perdido_horas: ["El tiempo perdido no debe superar 99,999,999.99."] };

describe("failureSchema", () => {
  it("acepta una falla valida", () => {
    expect(failureSchema.safeParse(buildInput()).success).toBe(true);
  });

  it("los obligatorios ausentes dan su mensaje en espanol", () => {
    expect(
      fieldErrors({ id_maquina: null, fecha_falla: null, descripcion: null, estado_atencion: null }),
    ).toEqual({
      id_maquina: ["Seleccione una máquina válida."],
      fecha_falla: ["La fecha de la falla es obligatoria."],
      descripcion: ["La descripción de la falla es obligatoria."],
      estado_atencion: ["Seleccione un estado de atención válido."],
    });
  });

  it("ningun mensaje es el de Zod", () => {
    const errors = fieldErrors({}) ?? {};

    expect(Object.values(errors).flat().join(" ")).not.toMatch(ZOD_DEFAULT);
  });

  it("una fecha vacia solo dice que es obligatoria", () => {
    expect(fieldErrors(buildInput({ fecha_falla: "" }))).toEqual({
      fecha_falla: ["La fecha de la falla es obligatoria."],
    });
  });

  it.each(["2026-02-30T10:00", "2026-07-14T25:00", "2026-07-14T09:61", "2026-07-14", "July 14 2026", "mañana"])(
    "rechaza %s",
    (fecha_falla) => {
      expect(fieldErrors(buildInput({ fecha_falla }))).toEqual(INVALID_DATE);
    },
  );

  it("acepta la hora con segundos y lee la fecha en la zona del proceso", () => {
    const parsed = failureSchema.parse(buildInput({ fecha_falla: "2026-07-14T09:30:15" }));

    expect(parsed.fecha_falla).toEqual(new Date("2026-07-14T09:30:15"));
  });

  it.each([
    ["99999999.99", null],
    ["99999999.995", MAX_HOURS_MESSAGE],
    ["1e12", MAX_HOURS_MESSAGE],
    ["-1", { tiempo_perdido_horas: ["El tiempo perdido no puede ser negativo."] }],
    ["dos", { tiempo_perdido_horas: ["El tiempo perdido debe ser un número válido."] }],
  ])("tiempo perdido %s", (tiempo_perdido_horas, errors) => {
    expect(fieldErrors(buildInput({ tiempo_perdido_horas }))).toEqual(errors);
  });
});

describe("failureStatusSchema", () => {
  it("un POST sin campos da sus mensajes en espanol", () => {
    const parsed = failureStatusSchema.safeParse({ id_falla: null, estado_atencion: null });

    expect(parsed.success ? null : parsed.error.flatten().fieldErrors).toEqual({
      id_falla: ["El identificador de la falla no es válido."],
      estado_atencion: ["Seleccione un estado de atención válido."],
    });
  });
});
