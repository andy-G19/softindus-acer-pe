import { describe, expect, it } from "vitest";

import { productCategorySchema } from "@/schemas/commercial/product-category.schema";

/**
 * Mensajes de validacion de categorias de producto (entrega 10.4a): todos en
 * espanol, ninguno con el texto por defecto de Zod. La ventana no limita el
 * largo de la descripcion, asi que el usuario veia el de Zod al pasar de 500
 * caracteres; sin nombre solo llega una peticion que no pasa por la ventana.
 * Los valores llegan como los arma la accion: undefined si el campo no viene.
 */
function fieldErrors(input: Record<string, unknown>) {
  const parsed = productCategorySchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;

describe("productCategorySchema · mensajes en espanol", () => {
  it("acepta una categoria valida, con la descripcion vacia", () => {
    expect(productCategorySchema.safeParse({ nombre: "Herramientas agrícolas", descripcion: "" }).success).toBe(true);
  });

  it("una descripcion de mas de 500 caracteres", () => {
    expect(fieldErrors({ nombre: "Herramientas agrícolas", descripcion: "x".repeat(501) })).toEqual({
      descripcion: ["La descripción no debe superar 500 caracteres."],
    });
  });

  it("sin nombre en la peticion", () => {
    expect(fieldErrors({ nombre: undefined, descripcion: "" })).toEqual({
      nombre: ["El nombre de la categoría es obligatorio."],
    });
  });

  it("ningun error queda con el texto por defecto de Zod", () => {
    const errors = fieldErrors({ nombre: undefined, descripcion: "x".repeat(501) });
    const messages = Object.values(errors ?? {}).flat();

    expect(messages).toHaveLength(2);
    expect(messages.filter((message) => ZOD_DEFAULT.test(message ?? ""))).toEqual([]);
  });
});
