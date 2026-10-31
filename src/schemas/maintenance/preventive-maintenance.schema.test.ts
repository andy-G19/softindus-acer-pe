import { describe, expect, it } from "vitest";

import {
  preventiveMaintenanceSchema,
  preventiveMaintenanceStatusSchema,
} from "@/schemas/maintenance/preventive-maintenance.schema";

/**
 * Validacion de mantenimientos preventivos (entrega 10.5b): mensajes en
 * espanol, ninguno con el texto por defecto de Zod, y fechas que existen. Los
 * valores llegan como los arma la accion: null si un campo obligatorio no viene
 * (formData.get); los opcionales tienen valor por defecto.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    id_maquina: "MAQ00000002",
    fecha_programada: "2026-07-20",
    responsable: "",
    actividad: "Cambio de aceite",
    estado: "pendiente",
    observaciones: "",
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = preventiveMaintenanceSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;

describe("preventiveMaintenanceSchema", () => {
  it("acepta un mantenimiento valido y deja la fecha en la medianoche del proceso", () => {
    const parsed = preventiveMaintenanceSchema.parse(buildInput());

    expect(parsed.fecha_programada).toEqual(new Date("2026-07-20T00:00:00"));
  });

  it("los obligatorios ausentes dan su mensaje en espanol", () => {
    expect(fieldErrors({ id_maquina: null, fecha_programada: null, actividad: null, estado: null })).toEqual({
      id_maquina: ["Seleccione una máquina válida."],
      fecha_programada: ["La fecha programada es obligatoria."],
      actividad: ["La actividad es obligatoria."],
      estado: ["Seleccione un estado válido."],
    });
  });

  it("ningun mensaje es el de Zod", () => {
    const errors = fieldErrors({}) ?? {};

    expect(Object.values(errors).flat().join(" ")).not.toMatch(ZOD_DEFAULT);
  });

  it("una fecha vacia solo dice que es obligatoria", () => {
    expect(fieldErrors(buildInput({ fecha_programada: "" }))).toEqual({
      fecha_programada: ["La fecha programada es obligatoria."],
    });
  });

  it.each(["2026-02-30", "2026-13-01", "2026-7-5", "mañana"])("rechaza %s", (fecha_programada) => {
    expect(fieldErrors(buildInput({ fecha_programada }))).toEqual({
      fecha_programada: ["La fecha programada no es válida."],
    });
  });
});

describe("preventiveMaintenanceStatusSchema", () => {
  it("un POST sin campos da sus mensajes en espanol", () => {
    const parsed = preventiveMaintenanceStatusSchema.safeParse({ id_mantenimiento: null, estado: null });

    expect(parsed.success ? null : parsed.error.flatten().fieldErrors).toEqual({
      id_mantenimiento: ["El identificador del mantenimiento no es válido."],
      estado: ["Seleccione un estado válido."],
    });
  });
});
