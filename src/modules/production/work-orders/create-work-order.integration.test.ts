import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkOrderAction } from "@/modules/production/work-orders/actions";
import { getTestDatabase } from "@/testing/test-database";

// Crear una orden de trabajo contra Postgres real (PGlite), C2 de la 11.6a (D63). Corre la accion
// entera: los candados del pedido, la ruta y la receta (su SQL se ejecuta de verdad sobre las
// tablas), las lecturas dentro de la transaccion, los correlativos, el requerimiento congelado y
// la bitacora. Solo se reemplazan la sesion y la cache de Next.
//
// C5 de la 11.6a (D66): la accion devuelve su estado y reclama una clave de operacion. Un rechazo
// deshace la transaccion y libera la clave: el envio corregido con la misma clave crea la orden.
// Repetir esa clave responde con la misma orden sin crear otra.
//
// Lo que no se puede probar aqui: cancelar un pedido mientras se crea su orden. En Postgres la
// segunda espera el candado del pedido y ve el estado final; PGlite atiende una sola transaccion
// a la vez (test-database.ts). Las repeticiones van una tras otra.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";
const CLIENTE = "CLI00000001";
const PRODUCTO = "PRO00000001";
const MATERIAL = "MAT00000001";
const RUTA = "RUT00000001";
const RECETA = "RTE00000001";
const VERSION = "VRE00000001";
const CLAVE = "3f6a9c21-8d4b-4e7a-b1c2-5d6e7f8a9b0c";

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
    data: { id_cliente: CLIENTE, tipo_cliente: "empresa", nombre_razon_social: "Cliente de prueba" },
  });
  await prisma.producto.create({
    data: { id_producto: PRODUCTO, nombre_producto: "Puerta de prueba", categoria: "puertas", unidad_medida: "unidad" },
  });
  await prisma.material.create({
    data: {
      id_material: MATERIAL,
      nombre_material: "Plancha de prueba",
      categoria: "planchas",
      unidad_medida: "unidad",
      stock_actual: "100.00",
      costo_unitario_actual: "12.50",
    },
  });
  await prisma.ruta_fabricacion.create({
    data: { id_ruta: RUTA, id_producto: PRODUCTO, nombre_ruta: "Ruta de prueba" },
  });
  await prisma.etapa_ruta.create({
    data: { id_etapa_ruta: "ETR00000001", id_ruta: RUTA, nombre_etapa: "Corte", orden_secuencia: 1 },
  });
  await prisma.receta_tecnica.create({
    data: { id_receta: RECETA, id_producto: PRODUCTO, nombre_receta: "Receta de prueba", id_usuario_creacion: USUARIO },
  });
  await prisma.version_receta.create({
    data: { id_version_receta: VERSION, id_receta: RECETA, numero_version: "v1", estado: "vigente" },
  });
  await prisma.detalle_receta.create({
    data: {
      id_detalle_receta: "DRE00000001",
      id_version_receta: VERSION,
      id_material: MATERIAL,
      cantidad_requerida: "2.50",
      unidad_medida: "unidad",
      tipo_consumo: "materia_prima",
    },
  });

  for (const [idPedido, estado] of [
    ["PED00000001", "cancelado"],
    ["PED00000002", "aprobado"],
  ]) {
    await prisma.pedido.create({
      data: { id_pedido: idPedido, id_cliente: CLIENTE, id_usuario_registro: USUARIO, estado },
    });
    await prisma.detalle_pedido.create({
      data: {
        id_detalle_pedido: `DPE${idPedido.slice(3)}`,
        id_pedido: idPedido,
        id_producto: PRODUCTO,
        cantidad: "2.00",
        precio_unitario: "100.00",
        subtotal: "200.00",
      },
    });
  }
});

async function createForOrder(idDetallePedido: string, clave: string = crypto.randomUUID()) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
    clave_operacion: clave,
    tipo_produccion: "pedido",
    id_detalle_pedido: idDetallePedido,
    id_campania: "",
    id_producto: "",
    id_ruta: RUTA,
    id_version_receta: VERSION,
    cantidad: "2",
    fecha_inicio: "2026-11-20",
    fecha_entrega_estimada: "",
    prioridad: "media",
    observaciones: "",
  })) {
    formData.set(key, value);
  }

  return createWorkOrderAction({ status: "idle" }, formData);
}

const CANCELLED =
  "El pedido PED00000001 está cancelado: solo se crean órdenes para pedidos registrados o aprobados.";

const orderStatus = async (idPedido: string) =>
  (await prisma.pedido.findUniqueOrThrow({ where: { id_pedido: idPedido }, select: { estado: true } })).estado;

const workOrdersOf = (idDetallePedido: string) =>
  prisma.orden_trabajo.findMany({
    where: { id_detalle_pedido: idDetallePedido },
    select: { id_orden_trabajo: true, id_cliente: true, requerimiento_orden_material: { select: { cantidad_requerida: true } } },
  });

describe("crear una orden de trabajo en Postgres", () => {
  it("un pedido cancelado no recibe una orden ni vuelve a produccion, y la clave queda libre", async () => {
    expect(await createForOrder("DPE00000001", CLAVE)).toMatchObject({
      status: "error",
      error: CANCELLED,
      fieldErrors: { id_detalle_pedido: [CANCELLED] },
    });

    expect(await workOrdersOf("DPE00000001")).toEqual([]);
    expect(await orderStatus("PED00000001")).toBe("cancelado");
    expect(await prisma.operacion_idempotente.findUnique({ where: { clave: CLAVE } })).toBeNull();
  });

  it("corregido con la misma clave, el pedido aprobado recibe su orden, con su cliente y su requerimiento, y pasa a produccion", async () => {
    const result = await createForOrder("DPE00000002", CLAVE);
    const orders = await workOrdersOf("DPE00000002");

    expect(result).toMatchObject({
      status: "success",
      data: { id_orden_trabajo: orders[0]?.id_orden_trabajo, clave_operacion: CLAVE },
    });
    expect(
      await prisma.operacion_idempotente.findUnique({
        where: { clave: CLAVE },
        select: { tipo_operacion: true, id_usuario: true, id_registro_resultado: true },
      }),
    ).toEqual({
      tipo_operacion: "crear_orden_trabajo",
      id_usuario: USUARIO,
      id_registro_resultado: orders[0]?.id_orden_trabajo,
    });

    expect(orders.map((order) => [order.id_cliente, order.requerimiento_orden_material.map((r) => r.cantidad_requerida.toFixed(2))])).toEqual([
      [CLIENTE, ["5.00"]],
    ]);
    expect(await orderStatus("PED00000002")).toBe("en_produccion");
  });

  it("repetir la misma clave responde con la misma orden, sin crear otra", async () => {
    const [created] = await workOrdersOf("DPE00000002");

    expect(await createForOrder("DPE00000002", CLAVE)).toMatchObject({
      status: "success",
      data: { id_orden_trabajo: created.id_orden_trabajo, clave_operacion: CLAVE },
    });
    expect(await workOrdersOf("DPE00000002")).toHaveLength(1);
  });

  it("con otra clave, el mismo pedido, ya en produccion, no recibe una segunda orden", async () => {
    expect(await createForOrder("DPE00000002")).toMatchObject({
      status: "error",
      error: "El pedido PED00000002 está en_produccion: solo se crean órdenes para pedidos registrados o aprobados.",
    });

    expect(await workOrdersOf("DPE00000002")).toHaveLength(1);
  });
});
