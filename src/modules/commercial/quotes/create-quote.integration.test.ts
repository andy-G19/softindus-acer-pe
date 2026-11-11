import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { annulQuoteAction, createQuoteAction } from "@/modules/commercial/quotes/actions";
import { getTestDatabase } from "@/testing/test-database";

// Crear proforma contra Postgres real (PGlite), 11.3a. Corre la accion entera: la clave de la
// operacion, el bloqueo del pedido (su SQL se ejecuta de verdad), los montos en centimos, el
// adelanto registrado como pago, la bitacora y el rollback de un rechazo. Solo se reemplazan la
// sesion y la cache de Next.
//
// Lo que no se puede probar aqui: dos altas simultaneas del mismo pedido o con la misma clave.
// En Postgres la segunda espera el bloqueo de la primera; PGlite atiende una sola transaccion a
// la vez (test-database.ts). Los reenvios van uno tras otro.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";
const CLIENTE = "CLI00000001";

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
    data: { id_cliente: CLIENTE, tipo_cliente: "empresa", nombre_razon_social: "Constructora de prueba" },
  });
  await prisma.producto.createMany({
    data: [
      { id_producto: "PRO00000001", nombre_producto: "Puerta metalica", categoria: "puertas", unidad_medida: "UND" },
      { id_producto: "PRO00000002", nombre_producto: "Reja de ventana", categoria: "rejas", unidad_medida: "UND" },
    ],
  });
});

/** Un pedido registrado de 100.10 + 200.20 = 300.30. */
async function createOrder(idPedido: string, estado = "registrado") {
  await prisma.pedido.create({
    data: { id_pedido: idPedido, id_cliente: CLIENTE, id_usuario_registro: USUARIO, estado },
  });
  await prisma.detalle_pedido.createMany({
    data: [
      {
        id_detalle_pedido: `DPE${idPedido.slice(3)}`,
        id_pedido: idPedido,
        id_producto: "PRO00000001",
        cantidad: "1",
        precio_unitario: "100.10",
        subtotal: "100.10",
      },
      {
        id_detalle_pedido: `DPF${idPedido.slice(3)}`,
        id_pedido: idPedido,
        id_producto: "PRO00000002",
        cantidad: "1",
        precio_unitario: "200.20",
        subtotal: "200.20",
      },
    ],
  });
}

function quoteForm(idPedido: string, changes: Record<string, string> = {}, clave: string = randomUUID()) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
    id_pedido: idPedido,
    adelanto_inicial: "",
    metodo_pago_adelanto: "",
    validez_dias: "15",
    observaciones: "",
    clave_operacion: clave,
    ...changes,
  })) {
    formData.set(key, value);
  }

  return formData;
}

const quotesOf = (idPedido: string) =>
  prisma.proforma.findMany({
    where: { id_pedido: idPedido },
    select: { id_proforma: true, monto_total: true, saldo: true, estado: true, adelanto_inicial: true },
  });

describe("crear proforma en Postgres", () => {
  it("un adelanto igual al total (100.10 + 200.20) la deja pagada y registra un pago de cancelacion", async () => {
    await createOrder("PED00000001");

    const state = await createQuoteAction(
      { status: "idle" },
      quoteForm("PED00000001", { adelanto_inicial: "300.30", metodo_pago_adelanto: "transferencia" }),
    );

    expect(state).toMatchObject({ status: "success" });

    const [quote] = await quotesOf("PED00000001");
    const payments = await prisma.pago_cliente.findMany({
      where: { id_proforma: quote.id_proforma },
      select: { monto_pagado: true, saldo_actual: true, tipo_pago: true },
    });

    expect([quote.monto_total.toFixed(2), quote.adelanto_inicial?.toFixed(2), quote.saldo.toFixed(2), quote.estado]).toEqual([
      "300.30",
      "300.30",
      "0.00",
      "pagada",
    ]);
    expect(payments.map((payment) => [payment.monto_pagado.toFixed(2), payment.saldo_actual.toFixed(2), payment.tipo_pago])).toEqual([
      ["300.30", "0.00", "cancelacion"],
    ]);
  });

  it("la misma clave dos veces deja una sola proforma y un solo adelanto", async () => {
    await createOrder("PED00000002");

    const clave = randomUUID();
    const form = () => quoteForm("PED00000002", { adelanto_inicial: "50.25", metodo_pago_adelanto: "yape" }, clave);

    const first = await createQuoteAction({ status: "idle" }, form());
    const second = await createQuoteAction({ status: "idle" }, form());

    expect(first).toMatchObject({ status: "success", data: { clave_operacion: clave } });
    expect(second).toMatchObject({ status: "success", data: (first as { data: unknown }).data });

    const quotes = await quotesOf("PED00000002");

    expect(quotes).toHaveLength(1);
    expect(quotes[0].estado).toBe("aceptada");
    expect(await prisma.pago_cliente.count({ where: { id_proforma: quotes[0].id_proforma } })).toBe(1);
    expect(
      await prisma.operacion_idempotente.findUnique({
        where: { clave },
        select: { tipo_operacion: true, id_registro_resultado: true },
      }),
    ).toEqual({ tipo_operacion: "crear_proforma", id_registro_resultado: quotes[0].id_proforma });
  });

  it("un pedido cancelado se rechaza en su campo, no escribe nada y libera la clave", async () => {
    await createOrder("PED00000003", "cancelado");

    const clave = randomUUID();
    const state = await createQuoteAction({ status: "idle" }, quoteForm("PED00000003", {}, clave));
    const message = "Solo se puede generar la proforma de un pedido registrado o aprobado.";

    expect(state).toMatchObject({ status: "error", fieldErrors: { id_pedido: [message] } });
    expect(await quotesOf("PED00000003")).toEqual([]);
    expect(await prisma.operacion_idempotente.count({ where: { clave } })).toBe(0);
  });

  // C6 de la 11.3a: lo que la confirmacion de anular promete, contra la base real.
  it("anular deja la proforma anulada y su pedido admite una proforma nueva", async () => {
    await createOrder("PED00000005");

    const created = await createQuoteAction({ status: "idle" }, quoteForm("PED00000005"));
    const idProforma = (created as { data: { id_proforma: string } }).data.id_proforma;
    const form = new FormData();

    form.set("id_proforma", idProforma);

    expect(await annulQuoteAction({ status: "idle" }, form)).toMatchObject({ status: "success", data: { estado: "anulada" } });
    expect((await quotesOf("PED00000005")).map((quote) => quote.estado)).toEqual(["anulada"]);
    expect(await createQuoteAction({ status: "idle" }, quoteForm("PED00000005"))).toMatchObject({ status: "success" });
  });

  it("anular una proforma con su adelanto registrado se rechaza y no la toca", async () => {
    await createOrder("PED00000006");

    const created = await createQuoteAction(
      { status: "idle" },
      quoteForm("PED00000006", { adelanto_inicial: "10", metodo_pago_adelanto: "efectivo" }),
    );
    const idProforma = (created as { data: { id_proforma: string } }).data.id_proforma;
    const form = new FormData();

    form.set("id_proforma", idProforma);

    expect(await annulQuoteAction({ status: "idle" }, form)).toMatchObject({
      status: "error",
      error: "No se puede anular una proforma con pagos registrados.",
    });
    expect((await quotesOf("PED00000006")).map((quote) => quote.estado)).toEqual(["aceptada"]);
  });

  it("un segundo alta del mismo pedido con otra clave se rechaza por la proforma activa", async () => {
    await createOrder("PED00000004");

    expect(await createQuoteAction({ status: "idle" }, quoteForm("PED00000004"))).toMatchObject({ status: "success" });

    const state = await createQuoteAction({ status: "idle" }, quoteForm("PED00000004"));

    expect(state).toMatchObject({ status: "error", fieldErrors: { id_pedido: [expect.stringMatching(/ya tiene una proforma activa/)] } });
    expect(await quotesOf("PED00000004")).toHaveLength(1);
  });
});
