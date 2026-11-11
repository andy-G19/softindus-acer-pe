import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createPaymentAction } from "@/modules/commercial/payments/actions";
import { getTestDatabase } from "@/testing/test-database";

// El pago de cliente contra Postgres real (PGlite), 11.3a. Corre la accion entera: la clave de la
// operacion, el bloqueo de la proforma (su SQL se ejecuta de verdad), el monto y el saldo en
// centimos, la bitacora y el rollback de un rechazo. Solo se reemplazan la sesion y la cache de
// Next.
//
// Lo que no se puede probar aqui: dos pagos simultaneos de la misma proforma o con la misma
// clave. En Postgres el segundo espera el bloqueo del primero; PGlite atiende una sola
// transaccion a la vez (test-database.ts). Los reenvios van uno tras otro.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";
const PEDIDO = "PED00000001";

let prisma: PrismaClient;

beforeAll(async () => {
  ({ prisma } = await getTestDatabase());

  await prisma.rol.create({ data: { id_rol: "ROL00000001", nombre_rol: "ADMIN" } });
  await prisma.usuario.create({
    data: {
      id_usuario: USUARIO,
      id_rol: "ROL00000001",
      nombres: "Andrea",
      apellidos: "Prueba",
      usuario: "andrea",
      clave_hash: "sin-uso",
    },
  });
  await prisma.cliente.create({
    data: { id_cliente: "CLI00000001", tipo_cliente: "empresa", nombre_razon_social: "Constructora de prueba" },
  });
  await prisma.pedido.create({
    data: { id_pedido: PEDIDO, id_cliente: "CLI00000001", id_usuario_registro: USUARIO },
  });
});

/** Una proforma de 300.30 con todo el saldo pendiente. */
async function createQuote(idProforma: string, estado = "vigente") {
  await prisma.proforma.create({
    data: {
      id_proforma: idProforma,
      id_pedido: PEDIDO,
      numero_proforma: idProforma.replace("PRF", "PF-"),
      monto_total: "300.30",
      saldo: "300.30",
      estado,
    },
  });
}

function paymentForm(idProforma: string, monto: string, clave: string = randomUUID()) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
    id_proforma: idProforma,
    monto_pagado: monto,
    metodo_pago: "yape",
    tipo_pago: "amortizacion",
    observaciones: "",
    clave_operacion: clave,
  })) {
    formData.set(key, value);
  }

  return formData;
}

const quoteOf = async (idProforma: string) => {
  const quote = await prisma.proforma.findUniqueOrThrow({
    where: { id_proforma: idProforma },
    select: { saldo: true, estado: true },
  });

  return [quote.saldo.toFixed(2), quote.estado];
};

describe("pago de cliente en Postgres", () => {
  it("dos pagos que suman el total (100.10 + 200.20) dejan saldo 0.00 y la proforma pagada", async () => {
    await createQuote("PRF00000001");

    expect(await createPaymentAction({ status: "idle" }, paymentForm("PRF00000001", "100.10"))).toMatchObject({
      status: "success",
    });
    expect(await quoteOf("PRF00000001")).toEqual(["200.20", "aceptada"]);

    expect(await createPaymentAction({ status: "idle" }, paymentForm("PRF00000001", "200.20"))).toMatchObject({
      status: "success",
    });
    expect(await quoteOf("PRF00000001")).toEqual(["0.00", "pagada"]);

    const payments = await prisma.pago_cliente.findMany({
      where: { id_proforma: "PRF00000001" },
      orderBy: { id_pago_cliente: "asc" },
      select: { monto_pagado: true, saldo_actual: true },
    });

    expect(payments.map((payment) => [payment.monto_pagado.toFixed(2), payment.saldo_actual.toFixed(2)])).toEqual([
      ["100.10", "200.20"],
      ["200.20", "0.00"],
    ]);
  });

  it("la misma clave dos veces deja un solo pago y descuenta el saldo una vez", async () => {
    await createQuote("PRF00000002");

    const clave = randomUUID();
    const first = await createPaymentAction({ status: "idle" }, paymentForm("PRF00000002", "50.25", clave));
    const second = await createPaymentAction({ status: "idle" }, paymentForm("PRF00000002", "50.25", clave));

    expect(first).toMatchObject({ status: "success", data: { clave_operacion: clave } });
    expect(second).toMatchObject({ status: "success", data: (first as { data: unknown }).data });
    expect(await prisma.pago_cliente.count({ where: { id_proforma: "PRF00000002" } })).toBe(1);
    expect(await quoteOf("PRF00000002")).toEqual(["250.05", "aceptada"]);
    expect(
      await prisma.operacion_idempotente.findUnique({ where: { clave }, select: { tipo_operacion: true } }),
    ).toEqual({ tipo_operacion: "registrar_pago_cliente" });
  });

  it("un pago mayor que el saldo se rechaza en su campo, no escribe nada y libera la clave", async () => {
    await createQuote("PRF00000003");

    const clave = randomUUID();
    const state = await createPaymentAction({ status: "idle" }, paymentForm("PRF00000003", "300.31", clave));
    const message = "El pago no puede ser mayor que el saldo pendiente: S/ 300.30.";

    expect(state).toMatchObject({ status: "error", fieldErrors: { monto_pagado: [message] } });
    expect(await prisma.pago_cliente.count({ where: { id_proforma: "PRF00000003" } })).toBe(0);
    expect(await quoteOf("PRF00000003")).toEqual(["300.30", "vigente"]);
    expect(await prisma.operacion_idempotente.count({ where: { clave } })).toBe(0);
  });

  it("una proforma anulada no recibe pagos", async () => {
    await createQuote("PRF00000004", "anulada");

    const state = await createPaymentAction({ status: "idle" }, paymentForm("PRF00000004", "10"));

    expect(state).toMatchObject({ status: "error", error: "No se puede registrar pagos en una proforma anulada." });
    expect(await prisma.pago_cliente.count({ where: { id_proforma: "PRF00000004" } })).toBe(0);
  });
});
