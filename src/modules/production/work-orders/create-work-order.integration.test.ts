import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkOrderAction } from "@/modules/production/work-orders/actions";
import { getTestDatabase } from "@/testing/test-database";

// Crear una orden de trabajo contra Postgres real (PGlite), C2 de la 11.6a (D63). Corre la accion
// entera: los candados del pedido, la ruta y la receta (su SQL se ejecuta de verdad sobre las
// tablas), las lecturas dentro de la transaccion, los correlativos, el requerimiento congelado y
// la bitacora. Solo se reemplazan la sesion y la cache de Next. La accion todavia redirige al
// guardar y lanza un error al rechazar: la prueba traduce lo primero a «guardado».
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
const SAVED = "guardado";

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

async function createForOrder(idDetallePedido: string) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
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

  try {
    await createWorkOrderAction(formData);

    return "termino sin redirigir";
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;

    return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")
      ? SAVED
      : error instanceof Error
        ? error.message
        : String(error);
  }
}

const orderStatus = async (idPedido: string) =>
  (await prisma.pedido.findUniqueOrThrow({ where: { id_pedido: idPedido }, select: { estado: true } })).estado;

const workOrdersOf = (idDetallePedido: string) =>
  prisma.orden_trabajo.findMany({
    where: { id_detalle_pedido: idDetallePedido },
    select: { id_orden_trabajo: true, id_cliente: true, requerimiento_orden_material: { select: { cantidad_requerida: true } } },
  });

describe("crear una orden de trabajo en Postgres", () => {
  it("un pedido cancelado no recibe una orden ni vuelve a produccion", async () => {
    expect(await createForOrder("DPE00000001")).toBe(
      "El pedido PED00000001 está cancelado: solo se crean órdenes para pedidos registrados o aprobados.",
    );

    expect(await workOrdersOf("DPE00000001")).toEqual([]);
    expect(await orderStatus("PED00000001")).toBe("cancelado");
  });

  it("un pedido aprobado recibe su orden, con su cliente y su requerimiento, y pasa a produccion", async () => {
    expect(await createForOrder("DPE00000002")).toBe(SAVED);

    const orders = await workOrdersOf("DPE00000002");

    expect(orders.map((order) => [order.id_cliente, order.requerimiento_orden_material.map((r) => r.cantidad_requerida.toFixed(2))])).toEqual([
      [CLIENTE, ["5.00"]],
    ]);
    expect(await orderStatus("PED00000002")).toBe("en_produccion");
  });

  it("el mismo pedido, ya en produccion, no recibe una segunda orden", async () => {
    expect(await createForOrder("DPE00000002")).toBe(
      "El pedido PED00000002 está en_produccion: solo se crean órdenes para pedidos registrados o aprobados.",
    );

    expect(await workOrdersOf("DPE00000002")).toHaveLength(1);
  });
});
