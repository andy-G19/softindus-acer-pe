import { describe, expect, it } from "vitest";

import { supplierMaterialSchema } from "@/schemas/inventory/supplier-material.schema";

/**
 * Mensajes de validacion de las asociaciones proveedor-material (entrega
 * 10.3b): todos en espanol, ninguno con el texto por defecto de Zod. El
 * formulario los evita con min, step y listas, pero la accion los devuelve a
 * una peticion que no pasa por el. Los valores llegan como en un FormData.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    id_proveedor: "PVE00000004",
    id_material: "MAT00000004",
    precio_referencial: "185.50",
    unidad_medida: "plancha",
    tiempo_entrega_dias: "3",
    disponibilidad: "alta",
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = supplierMaterialSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;

describe("supplierMaterialSchema · mensajes en espanol", () => {
  it("acepta una asociacion valida, con los opcionales vacios", () => {
    expect(supplierMaterialSchema.safeParse(buildInput()).success).toBe(true);
    expect(
      supplierMaterialSchema.safeParse(buildInput({ precio_referencial: "", tiempo_entrega_dias: "", disponibilidad: "" })).success,
    ).toBe(true);
  });

  it("un precio o un tiempo de entrega que no son numeros", () => {
    expect(fieldErrors(buildInput({ precio_referencial: "abc", tiempo_entrega_dias: "tres" }))).toEqual({
      precio_referencial: ["El precio referencial debe ser numérico."],
      tiempo_entrega_dias: ["El tiempo de entrega debe ser numérico."],
    });
  });

  it("un precio o un tiempo de entrega negativos", () => {
    expect(fieldErrors(buildInput({ precio_referencial: "-1", tiempo_entrega_dias: "-2" }))).toEqual({
      precio_referencial: ["El precio referencial no puede ser negativo."],
      tiempo_entrega_dias: ["El tiempo de entrega no puede ser negativo."],
    });
  });

  it("una disponibilidad que no esta en la lista", () => {
    expect(fieldErrors(buildInput({ disponibilidad: "siempre" }))).toEqual({
      disponibilidad: ["Selecciona una disponibilidad válida."],
    });
  });

  it("sin proveedor, material ni unidad en la peticion (FormData da null)", () => {
    expect(fieldErrors(buildInput({ id_proveedor: null, id_material: null, unidad_medida: null }))).toEqual({
      id_proveedor: ["Seleccione un proveedor."],
      id_material: ["Seleccione un material."],
      unidad_medida: ["La unidad de medida es obligatoria."],
    });
  });

  it("ningun error queda con el texto por defecto de Zod", () => {
    const errors = fieldErrors({
      id_proveedor: null,
      id_material: "",
      precio_referencial: "-1",
      unidad_medida: "x".repeat(21),
      tiempo_entrega_dias: "abc",
      disponibilidad: "siempre",
    });
    const messages = Object.values(errors ?? {}).flat();

    expect(messages).toHaveLength(6);
    expect(messages.filter((message) => ZOD_DEFAULT.test(message ?? ""))).toEqual([]);
  });
});
