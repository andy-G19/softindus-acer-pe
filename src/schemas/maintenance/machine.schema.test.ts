import { describe, expect, it } from "vitest";

import { machineSchema } from "@/schemas/maintenance/machine.schema";

/**
 * Mensajes de validacion de maquinas (entrega 10.5a): todos en espanol,
 * ninguno con el texto por defecto de Zod. Los campos que faltan solo llegan
 * con una peticion que no pasa por el formulario. Los valores llegan como los
 * arma la accion: null si un obligatorio no viene (formData.get) y "" si es
 * un opcional.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    nombre: "Prensa hidráulica 60 t",
    tipo: "prensa",
    codigo_interno: "PH-60",
    ubicacion: "Nave 1",
    estado: "operativa",
    observaciones: "",
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = machineSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;

describe("machineSchema · mensajes en espanol", () => {
  it("acepta una maquina valida, con los opcionales vacios", () => {
    expect(machineSchema.safeParse(buildInput()).success).toBe(true);
    expect(machineSchema.safeParse(buildInput({ codigo_interno: "", ubicacion: "" })).success).toBe(true);
  });

  it("sin nombre, tipo ni estado en la peticion", () => {
    expect(fieldErrors(buildInput({ nombre: null, tipo: null, estado: null }))).toEqual({
      nombre: ["El nombre de la máquina es obligatorio."],
      tipo: ["El tipo de máquina es obligatorio."],
      estado: ["Seleccione un estado válido para la máquina."],
    });
  });

  it("ningun error queda con el texto por defecto de Zod", () => {
    const errors = fieldErrors({
      nombre: null,
      tipo: null,
      codigo_interno: "x".repeat(31),
      ubicacion: "x".repeat(101),
      estado: null,
      observaciones: "x".repeat(501),
    });
    const messages = Object.values(errors ?? {}).flat();

    expect(messages).toHaveLength(6);
    expect(messages.filter((message) => ZOD_DEFAULT.test(message ?? ""))).toEqual([]);
  });
});
