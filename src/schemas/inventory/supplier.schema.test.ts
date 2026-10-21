import { describe, expect, it } from "vitest";

import { quickSupplierSchema, supplierSchema } from "@/schemas/inventory/supplier.schema";

/**
 * Mensajes de validacion de proveedores (entrega 10.3b). El formulario no
 * limita el largo de los campos, asi que un usuario ve estos mensajes al
 * escribir de mas: todos deben estar en espanol, ninguno con el texto por
 * defecto de Zod. Los valores llegan como strings porque vienen de un FormData.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    razon_social: "Aceros del Sur S.A.C.",
    tipo_documento: "ruc",
    numero_documento: "20601234567",
    telefono: "999 888 777",
    correo: "ventas@acerosdelsur.pe",
    direccion: "Av. Industrial 123",
    contacto_principal: "Rosa Quispe",
    tipo_proveedor: "distribuidor",
    condicion_pago: "credito",
    observaciones: "",
    ...overrides,
  };
}

function fieldErrors(schema: typeof supplierSchema | typeof quickSupplierSchema, input: Record<string, unknown>) {
  const parsed = schema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;

describe("supplierSchema · mensajes en espanol", () => {
  it("acepta un proveedor valido", () => {
    expect(supplierSchema.safeParse(buildInput()).success).toBe(true);
  });

  it.each([
    ["numero_documento", 21, "El número de documento no debe superar 20 caracteres."],
    ["telefono", 21, "El teléfono no debe superar 20 caracteres."],
    ["direccion", 151, "La dirección no debe superar 150 caracteres."],
    ["contacto_principal", 101, "El contacto principal no debe superar 100 caracteres."],
    ["observaciones", 501, "Las observaciones no deben superar 500 caracteres."],
  ])("%s con %i caracteres", (field, length, message) => {
    expect(fieldErrors(supplierSchema, buildInput({ [field]: "x".repeat(length) }))).toEqual({ [field]: [message] });
  });

  it("un correo de mas de 100 caracteres", () => {
    const correo = `${"a".repeat(95)}@acero.pe`;

    expect(fieldErrors(supplierSchema, buildInput({ correo }))).toEqual({
      correo: ["El correo no debe superar 100 caracteres."],
    });
  });

  it("un tipo de documento o una condicion de pago que no estan en la lista", () => {
    expect(fieldErrors(supplierSchema, buildInput({ tipo_documento: "pasaporte", condicion_pago: "trueque" }))).toEqual({
      tipo_documento: ["Selecciona un tipo de documento válido."],
      condicion_pago: ["Selecciona una condición de pago válida."],
    });
  });

  it("sin razon social ni tipo de proveedor en la peticion", () => {
    expect(fieldErrors(supplierSchema, buildInput({ razon_social: undefined, tipo_proveedor: undefined }))).toEqual({
      razon_social: ["La razón social es obligatoria."],
      tipo_proveedor: ["El tipo de proveedor es obligatorio."],
    });
  });

  it("ningun error del formulario queda con el texto por defecto de Zod", () => {
    const errors = fieldErrors(
      supplierSchema,
      buildInput({
        razon_social: "x".repeat(151),
        tipo_documento: "pasaporte",
        numero_documento: "x".repeat(21),
        telefono: "x".repeat(21),
        correo: "no-es-correo",
        direccion: "x".repeat(151),
        contacto_principal: "x".repeat(101),
        tipo_proveedor: "x".repeat(81),
        condicion_pago: "trueque",
        observaciones: "x".repeat(501),
      }),
    );
    const messages = Object.values(errors ?? {}).flat();

    expect(messages).toHaveLength(10);
    expect(messages.filter((message) => ZOD_DEFAULT.test(message ?? ""))).toEqual([]);
  });
});

describe("quickSupplierSchema · mensajes en espanol", () => {
  it("un telefono de mas de 20 caracteres", () => {
    expect(
      fieldErrors(quickSupplierSchema, { razon_social: "Ferreteria El Perno", tipo_proveedor: "ferreteria", telefono: "x".repeat(21) }),
    ).toEqual({ telefono: ["El teléfono no debe superar 20 caracteres."] });
  });

  it("sin razon social ni tipo de proveedor", () => {
    expect(fieldErrors(quickSupplierSchema, {})).toEqual({
      razon_social: ["La razón social es obligatoria."],
      tipo_proveedor: ["El tipo de proveedor es obligatorio."],
    });
  });
});
