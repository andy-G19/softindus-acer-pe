import { describe, expect, it } from "vitest";

import { orderSchema } from "@/schemas/commercial/order.schema";

/**
 * Validacion de pedidos (10.4c, C4): mensajes en espanol, limites de las
 * columnas y fecha que existe. Los valores llegan como los arma la accion:
 * undefined si el campo no viene y texto en los numeros. Un campo que falta, un
 * numero que no lo es o una fecha que no existe solo llegan con una peticion que
 * no pasa por el formulario (el navegador valida number y date); una cantidad o
 * un precio fuera de la columna llegaban a la base y daban un error 500.
 */
function buildInput(overrides: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return {
    id_cliente: "CLI00000001",
    fecha_entrega_estimada: "2026-07-20",
    observaciones: "",
    items: [{ id_producto: "PRO00000001", cantidad: "2", precio_unitario: "150", observaciones: "", ...item }],
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const parsed = orderSchema.safeParse(input);

  return parsed.success ? null : parsed.error.flatten().fieldErrors;
}

const ZOD_DEFAULT = /expected|invalid|too (big|small)|received/i;

describe("orderSchema · mensajes en espanol", () => {
  it("acepta un pedido valido, con la fecha vacia o ausente", () => {
    expect(orderSchema.safeParse(buildInput()).success).toBe(true);
    expect(orderSchema.safeParse(buildInput({ fecha_entrega_estimada: "" })).success).toBe(true);
    expect(orderSchema.safeParse(buildInput({ fecha_entrega_estimada: undefined })).success).toBe(true);
  });

  it("sin el campo cliente", () => {
    expect(fieldErrors(buildInput({ id_cliente: undefined }))).toEqual({
      id_cliente: ["Debes seleccionar un cliente."],
    });
  });

  it("sin la lista de productos", () => {
    expect(fieldErrors(buildInput({ items: undefined }))).toEqual({
      items: ["El pedido debe tener al menos un producto."],
    });
  });

  it.each([
    ["no es un numero", "abc"],
    ["falta", undefined],
  ])("una cantidad que %s", (_name, cantidad) => {
    expect(fieldErrors(buildInput({}, { cantidad }))).toEqual({ items: ["La cantidad debe ser un número."] });
  });

  it.each([
    ["no es un numero", "abc"],
    ["es infinito", "1e400"],
  ])("un precio que %s", (_name, precio_unitario) => {
    expect(fieldErrors(buildInput({}, { precio_unitario }))).toEqual({
      items: ["El precio unitario debe ser un número."],
    });
  });

  it("ningun mensaje es el de Zod", () => {
    const inputs = [
      buildInput({ id_cliente: undefined, items: undefined }),
      buildInput({}, { cantidad: "abc", precio_unitario: "1e400" }),
      buildInput({ fecha_entrega_estimada: "abc" }),
    ];

    for (const input of inputs) {
      const messages = Object.values(fieldErrors(input) ?? {}).flat();
      expect(messages.length).toBeGreaterThan(0);
      for (const message of messages) {
        expect(message).not.toMatch(ZOD_DEFAULT);
      }
    }
  });
});

describe("orderSchema · limites de las columnas", () => {
  it("la cantidad mayor que la columna numeric(10,2)", () => {
    expect(orderSchema.safeParse(buildInput({}, { cantidad: "99999999.99", precio_unitario: "1" })).success).toBe(true);
    expect(fieldErrors(buildInput({}, { cantidad: "100000000" }))).toEqual({
      items: ["La cantidad no debe superar 99,999,999.99."],
    });
  });

  it("el precio mayor que la columna numeric(12,2)", () => {
    expect(orderSchema.safeParse(buildInput({}, { cantidad: "1", precio_unitario: "9999999999.99" })).success).toBe(
      true,
    );
    expect(fieldErrors(buildInput({}, { cantidad: "1", precio_unitario: "10000000000" }))).toEqual({
      items: ["El precio unitario no debe superar S/ 9,999,999,999.99."],
    });
  });

  it("un subtotal que no cabe en la columna", () => {
    expect(fieldErrors(buildInput({}, { cantidad: "100000", precio_unitario: "100000" }))).toEqual({
      items: ["El subtotal de un producto no debe superar S/ 9,999,999,999.99."],
    });
  });

  it("un monto que no cabe en la columna aunque cada subtotal quepa", () => {
    const line = { id_producto: "PRO00000001", cantidad: "1", precio_unitario: "6000000000", observaciones: "" };
    const input = buildInput({ items: [line, { ...line, id_producto: "PRO00000002" }] });

    expect(fieldErrors(input)).toEqual({
      items: ["El monto estimado del pedido no debe superar S/ 9,999,999,999.99."],
    });
  });

  it("una cantidad que la base guardaria como cero", () => {
    expect(fieldErrors(buildInput({}, { cantidad: "0.004" }))).toEqual({
      items: ["La cantidad debe ser mayor que cero."],
    });
    expect(orderSchema.safeParse(buildInput({}, { cantidad: "0.005" })).success).toBe(true);
  });
});

describe("orderSchema · fecha estimada de entrega", () => {
  it.each(["2026-02-30", "2026-13-01", "abc", "2026-7-5"])("%s no es una fecha valida", (fecha) => {
    expect(fieldErrors(buildInput({ fecha_entrega_estimada: fecha }))).toEqual({
      fecha_entrega_estimada: ["La fecha estimada de entrega no es válida."],
    });
  });

  it("acepta el 29 de febrero de un bisiesto", () => {
    expect(orderSchema.safeParse(buildInput({ fecha_entrega_estimada: "2028-02-29" })).success).toBe(true);
  });
});
