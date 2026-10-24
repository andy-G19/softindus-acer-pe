import { describe, expect, it } from "vitest";

import { clientSchema } from "@/schemas/commercial/client.schema";

/**
 * Mensajes de validacion de clientes (entrega 10.4a): todos en espanol,
 * ninguno con el texto por defecto de Zod. El panel no limita el largo del
 * documento, el telefono, la direccion ni el lugar de origen, asi que el
 * usuario veia el de Zod al pasarse; un tipo que no esta en la lista y los
 * campos obligatorios que faltan solo llegan con una peticion que no pasa por
 * el panel. Los valores llegan como los arma la accion: undefined si el tipo
 * de cliente o el nombre no vienen, y texto vacio en los demas.
 */
function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    tipo_cliente: "ferreteria",
    nombre_razon_social: "Ferreteria Andina SAC",
    tipo_documento: "ruc",
    numero_documento: "20123456789",
    telefono: "987654321",
    correo: "compras@andina.pe",
    direccion: "Av. Industrial 123",
    lugar_origen: "Arequipa",
    observaciones: "",
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = clientSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid input|invalid option|too (big|small)|received/i;

describe("clientSchema · mensajes en espanol", () => {
  it("acepta un cliente valido, con los opcionales vacios", () => {
    expect(clientSchema.safeParse(buildInput()).success).toBe(true);
    expect(
      clientSchema.safeParse(
        buildInput({ tipo_documento: "", numero_documento: "", telefono: "", correo: "", direccion: "", lugar_origen: "" }),
      ).success,
    ).toBe(true);
  });

  it("el documento, el telefono, la direccion y el lugar de origen demasiado largos", () => {
    expect(
      fieldErrors(
        buildInput({
          numero_documento: "1".repeat(21),
          telefono: "9".repeat(21),
          direccion: "x".repeat(151),
          lugar_origen: "x".repeat(101),
        }),
      ),
    ).toEqual({
      numero_documento: ["El número de documento no debe superar 20 caracteres."],
      telefono: ["El teléfono no debe superar 20 caracteres."],
      direccion: ["La dirección no debe superar 150 caracteres."],
      lugar_origen: ["El lugar de origen no debe superar 100 caracteres."],
    });
  });

  it("un tipo de cliente o de documento que no esta en la lista", () => {
    expect(fieldErrors(buildInput({ tipo_cliente: "mayorista", tipo_documento: "pasaporte" }))).toEqual({
      tipo_cliente: ["Selecciona un tipo de cliente válido."],
      tipo_documento: ["Selecciona un tipo de documento válido."],
    });
  });

  it("sin tipo de cliente ni nombre en la peticion", () => {
    expect(fieldErrors(buildInput({ tipo_cliente: undefined, nombre_razon_social: undefined }))).toEqual({
      tipo_cliente: ["Selecciona un tipo de cliente válido."],
      nombre_razon_social: ["El nombre o razón social es obligatorio."],
    });
  });

  it("ningun error queda con el texto por defecto de Zod", () => {
    const errors = fieldErrors({
      tipo_cliente: "mayorista",
      nombre_razon_social: undefined,
      tipo_documento: "pasaporte",
      numero_documento: "1".repeat(21),
      telefono: "9".repeat(21),
      correo: "no-es-correo",
      direccion: "x".repeat(151),
      lugar_origen: "x".repeat(101),
      observaciones: "",
    });
    const messages = Object.values(errors ?? {}).flat();

    expect(messages).toHaveLength(8);
    expect(messages.filter((message) => ZOD_DEFAULT.test(message ?? ""))).toEqual([]);
  });
});
