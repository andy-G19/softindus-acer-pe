import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { cancelOrderAction } from "@/modules/commercial/orders/actions";
import { getQuotableOrders } from "@/modules/commercial/quotes/queries";
import { getTestDatabase } from "@/testing/test-database";

// Cancelar pedido contra Postgres real (PGlite), 11.3b. Corre la accion entera: el bloqueo del
// pedido (su SQL se ejecuta de verdad), la regla comun de order-rules.ts con el estado real de
// proformas y comprobantes, la cancelacion con su bitacora y lo que la confirmacion promete: un
// pedido cancelado ya no se ofrece para una proforma.
//
// Lo que no se puede probar aqui: cancelar y crear la proforma a la vez. En Postgres los dos
// bloquean el pedido y van en fila; PGlite atiende una sola transaccion a la vez.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";

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
  await prisma.producto.create({
    data: { id_producto: "PRO00000001", nombre_producto: "Puerta metalica", categoria: "puertas", unidad_medida: "UND" },
  });
});

async function createOrder(idPedido: string, quoteState?: string) {
  await prisma.pedido.create({ data: { id_pedido: idPedido, id_cliente: "CLI00000001", id_usuario_registro: USUARIO } });
  await prisma.detalle_pedido.create({
    data: {
      id_detalle_pedido: `DPE${idPedido.slice(3)}`,
      id_pedido: idPedido,
      id_producto: "PRO00000001",
      cantidad: "1",
      precio_unitario: "100",
      subtotal: "100",
    },
  });

  if (quoteState) {
    await prisma.proforma.create({
      data: {
        id_proforma: `PRF${idPedido.slice(3)}`,
        id_pedido: idPedido,
        numero_proforma: `PF-${idPedido.slice(3)}`,
        monto_total: "100",
        saldo: "100",
        estado: quoteState,
      },
    });
  }
}

const cancel = (idPedido: string) => {
  const formData = new FormData();

  formData.set("id_pedido", idPedido);

  return cancelOrderAction({ status: "idle" }, formData);
};

const stateOf = async (idPedido: string) =>
  (await prisma.pedido.findUniqueOrThrow({ where: { id_pedido: idPedido }, select: { estado: true } })).estado;

describe("cancelar pedido en Postgres", () => {
  it("un pedido con su unica proforma anulada se cancela y deja de ofrecerse para una proforma (D30)", async () => {
    await createOrder("PED00000001", "anulada");

    expect((await getQuotableOrders()).map((order) => order.id_pedido)).toContain("PED00000001");
    expect(await cancel("PED00000001")).toMatchObject({ status: "success", data: { estado: "cancelado" } });
    expect(await stateOf("PED00000001")).toBe("cancelado");
    expect((await getQuotableOrders()).map((order) => order.id_pedido)).not.toContain("PED00000001");
    expect(
      await prisma.bitacora_operacion.count({ where: { entidad_afectada: "pedido", id_registro_afectado: "PED00000001", accion: "cancelar" } }),
    ).toBe(1);
  });

  it("un pedido con una proforma vigente no se cancela y queda como estaba", async () => {
    await createOrder("PED00000002", "vigente");

    expect(await cancel("PED00000002")).toMatchObject({
      status: "error",
      error: "No se puede modificar un pedido con proforma, comprobante u orden asociada.",
    });
    expect(await stateOf("PED00000002")).toBe("registrado");
  });

  it("cancelarlo dos veces: la segunda lo dice en la confirmacion", async () => {
    await createOrder("PED00000003");

    expect(await cancel("PED00000003")).toMatchObject({ status: "success" });
    expect(await cancel("PED00000003")).toMatchObject({ status: "error", error: "No se puede modificar un pedido cancelado." });
  });
});
