import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createReceiptAction } from "@/modules/commercial/receipts/actions";
import { getTestDatabase } from "@/testing/test-database";

// Emitir comprobante contra Postgres real (PGlite), 11.3b. Corre la accion entera: la clave de la
// operacion, el bloqueo de la proforma (su SQL se ejecuta de verdad), el monto en centimos, el
// indice unico del numero y el rollback de un rechazo. Solo se reemplazan la sesion y la cache.
//
// Lo que no se puede probar aqui: dos comprobantes simultaneos. En Postgres el segundo espera el
// bloqueo de la proforma, y un numero tomado por otra proforma entre la busqueda y el alta
// rompe en el indice (P2002, traducido a su campo en actions.test.ts); PGlite atiende una sola
// transaccion a la vez (test-database.ts).

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
  await prisma.pedido.create({ data: { id_pedido: PEDIDO, id_cliente: "CLI00000001", id_usuario_registro: USUARIO } });
});

async function createQuote(idProforma: string) {
  await prisma.proforma.create({
    data: {
      id_proforma: idProforma,
      id_pedido: PEDIDO,
      numero_proforma: idProforma.replace("PRF", "PF-"),
      monto_total: "150.50",
      saldo: "150.50",
      estado: "aceptada",
    },
  });
}

function receiptForm(idProforma: string, numero: string, changes: Record<string, string> = {}, clave: string = randomUUID()) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
    id_proforma: idProforma,
    tipo_comprobante: "boleta",
    numero_comprobante: numero,
    monto_total: "150.50",
    observaciones: "",
    clave_operacion: clave,
    ...changes,
  })) {
    formData.set(key, value);
  }

  return formData;
}

const receiptsOf = (idProforma: string) =>
  prisma.comprobante_venta.findMany({
    where: { id_proforma: idProforma },
    select: { numero_comprobante: true, monto_total: true, estado: true },
  });

describe("emitir comprobante en Postgres", () => {
  it("la misma clave dos veces emite un solo comprobante", async () => {
    await createQuote("PRF00000001");

    const clave = randomUUID();
    const first = await createReceiptAction({ status: "idle" }, receiptForm("PRF00000001", "B001-000001", {}, clave));
    const second = await createReceiptAction({ status: "idle" }, receiptForm("PRF00000001", "B001-000001", {}, clave));

    expect(first).toMatchObject({ status: "success", data: { clave_operacion: clave } });
    expect(second).toMatchObject({ status: "success", data: (first as { data: unknown }).data });
    expect((await receiptsOf("PRF00000001")).map((receipt) => [receipt.numero_comprobante, receipt.monto_total.toFixed(2), receipt.estado])).toEqual([
      ["B001-000001", "150.50", "emitido"],
    ]);
  });

  it("un numero ya usado en otra proforma se rechaza en su campo, no escribe y libera la clave", async () => {
    await createQuote("PRF00000002");

    const clave = randomUUID();
    const state = await createReceiptAction({ status: "idle" }, receiptForm("PRF00000002", "B001-000001", {}, clave));
    const message = "Ya existe un comprobante con ese número.";

    expect(state).toMatchObject({ status: "error", fieldErrors: { numero_comprobante: [message] } });
    expect(await receiptsOf("PRF00000002")).toEqual([]);
    expect(await prisma.operacion_idempotente.count({ where: { clave } })).toBe(0);
  });

  it("150.504 sobre un total de 150.50 se guarda como 150.50", async () => {
    await createQuote("PRF00000003");

    const state = await createReceiptAction({ status: "idle" }, receiptForm("PRF00000003", "B001-000003", { monto_total: "150.504" }));

    expect(state).toMatchObject({ status: "success" });
    expect((await receiptsOf("PRF00000003")).map((receipt) => receipt.monto_total.toFixed(2))).toEqual(["150.50"]);
  });

  it("una proforma con su comprobante emitido no admite otro", async () => {
    const state = await createReceiptAction({ status: "idle" }, receiptForm("PRF00000001", "B001-000099"));

    expect(state).toMatchObject({ status: "error", error: "Esta proforma ya tiene un comprobante emitido: B001-000001." });
    expect(await receiptsOf("PRF00000001")).toHaveLength(1);
  });
});
