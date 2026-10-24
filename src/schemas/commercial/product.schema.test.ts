import { describe, expect, it } from "vitest";

import { productSchema } from "@/schemas/commercial/product.schema";

/**
 * Mensajes de validacion de productos (entrega 10.4a): todos en espanol,
 * ninguno con el texto por defecto de Zod. El formulario no limita el largo de
 * la descripcion, asi que el usuario veia el de Zod al pasar de 500
 * caracteres; los campos que faltan y un precio que no es numero solo llegan
 * con una peticion que no pasa por el formulario. Los valores llegan como los
 * arma la accion: undefined si el campo no viene.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    nombre_producto: "Lampa agrícola reforzada",
    categoria: "herramientas",
    descripcion: "Mango de eucalipto.",
    unidad_medida: "unidad",
    precio_referencial: "35.50",
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = productSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;

describe("productSchema · mensajes en espanol", () => {
  it("acepta un producto valido, con el precio y la descripcion vacios", () => {
    expect(productSchema.safeParse(buildInput()).success).toBe(true);
    expect(productSchema.safeParse(buildInput({ precio_referencial: undefined, descripcion: "" })).success).toBe(true);
  });

  it("una descripcion de mas de 500 caracteres", () => {
    expect(fieldErrors(buildInput({ descripcion: "x".repeat(501) }))).toEqual({
      descripcion: ["La descripción no debe superar 500 caracteres."],
    });
  });

  it("un precio que no es un numero", () => {
    expect(fieldErrors(buildInput({ precio_referencial: "abc" }))).toEqual({
      precio_referencial: ["El precio referencial debe ser numérico."],
    });
  });

  it("sin nombre, categoria ni unidad en la peticion", () => {
    expect(
      fieldErrors(buildInput({ nombre_producto: undefined, categoria: undefined, unidad_medida: undefined })),
    ).toEqual({
      nombre_producto: ["El nombre del producto es obligatorio."],
      categoria: ["La categoría es obligatoria."],
      unidad_medida: ["La unidad de medida es obligatoria."],
    });
  });

  it("ningun error queda con el texto por defecto de Zod", () => {
    const errors = fieldErrors({
      nombre_producto: undefined,
      categoria: "x".repeat(81),
      descripcion: "x".repeat(501),
      unidad_medida: undefined,
      precio_referencial: "abc",
    });
    const messages = Object.values(errors ?? {}).flat();

    expect(messages).toHaveLength(5);
    expect(messages.filter((message) => ZOD_DEFAULT.test(message ?? ""))).toEqual([]);
  });
});
