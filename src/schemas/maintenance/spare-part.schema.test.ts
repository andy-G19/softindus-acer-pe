import { describe, expect, it } from "vitest";

import { sparePartSchema } from "@/schemas/maintenance/spare-part.schema";

/**
 * Validacion de repuestos (entrega 10.5a): mensajes en espanol, ninguno con el
 * texto por defecto de Zod, y el costo dentro de su columna. Los valores
 * llegan como los arma la accion: null si el nombre o el costo no vienen
 * (formData.get); el proveedor, la descripcion y el estado tienen valor por
 * defecto.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    id_proveedor: "PVE00000003",
    nombre_repuesto: "Faja en V B-52",
    descripcion: "",
    costo_unitario: "38.50",
    estado: "true",
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = sparePartSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;
const MAX_COST_MESSAGE = "El costo unitario no debe superar S/ 9,999,999,999.99.";

describe("sparePartSchema · mensajes en espanol", () => {
  it("acepta un repuesto valido, sin proveedor ni descripcion", () => {
    expect(sparePartSchema.safeParse(buildInput()).success).toBe(true);
    expect(sparePartSchema.safeParse(buildInput({ id_proveedor: "", descripcion: "" })).success).toBe(true);
  });

  it("sin nombre ni costo en la peticion", () => {
    expect(fieldErrors(buildInput({ nombre_repuesto: null, costo_unitario: null }))).toEqual({
      nombre_repuesto: ["El nombre del repuesto es obligatorio."],
      costo_unitario: ["El costo unitario es obligatorio."],
    });
  });

  it("ningun error queda con el texto por defecto de Zod", () => {
    const errors = fieldErrors({
      id_proveedor: "PVE1",
      nombre_repuesto: null,
      descripcion: "x".repeat(501),
      costo_unitario: null,
      estado: null,
    });
    const messages = Object.values(errors ?? {}).flat();

    expect(messages).toHaveLength(5);
    expect(messages.filter((message) => ZOD_DEFAULT.test(message ?? ""))).toEqual([]);
  });
});

// costo_unitario es numeric(12,2): un valor mayor llegaba a la base y daba un
// error 500. Un tercer decimal lo redondea la base, como en pedidos.
describe("sparePartSchema · limite de la columna", () => {
  it("acepta el mayor costo que cabe en numeric(12,2)", () => {
    expect(sparePartSchema.safeParse(buildInput({ costo_unitario: "9999999999.99" })).success).toBe(true);
  });

  it("rechaza un costo mayor que la columna", () => {
    for (const costo of ["10000000000", "1e12", "Infinity"]) {
      expect(fieldErrors(buildInput({ costo_unitario: costo }))).toEqual({ costo_unitario: [MAX_COST_MESSAGE] });
    }
  });

  it("rechaza un costo que la base redondearia por encima del limite", () => {
    expect(fieldErrors(buildInput({ costo_unitario: "9999999999.995" }))).toEqual({
      costo_unitario: [MAX_COST_MESSAGE],
    });
  });

  it("un costo con tres decimales pasa: lo redondea la base", () => {
    expect(sparePartSchema.safeParse(buildInput({ costo_unitario: "1.005" })).success).toBe(true);
  });
});
