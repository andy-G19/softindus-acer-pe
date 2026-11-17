import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  closeWorkOrderMaterialsAction,
  deliverAdditionalMaterialAction,
  returnWorkOrderMaterialAction,
} from "@/modules/production/work-orders/actions";
import { getTestDatabase } from "@/testing/test-database";

// Movimientos de material de una orden de trabajo contra Postgres real (PGlite), C1 de la 11.6a
// (D62). Corre las acciones enteras: el candado de la orden, el descuento atomico del stock, el
// kardex, el requerimiento congelado, la alerta y la bitacora. Solo se reemplazan la sesion y la
// cache de Next. Cerrar todavia redirige al guardar y lanza un error al rechazar: la prueba
// traduce lo primero a «guardado». Desde C1 de la 11.6b la entrega adicional y la devolucion
// devuelven su estado y reclaman una clave de operacion (runState).
//
// Las columnas son numeric(10, 2) y cada una redondea por su lado: una cantidad sin redondear
// dejaba el stock, lo entregado y el kardex en desacuerdo (hallazgo 1 de la 11.6).

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";
const PRODUCTO = "PRO00000001";
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
  await prisma.producto.create({
    data: { id_producto: PRODUCTO, nombre_producto: "Puerta de prueba", categoria: "puertas", unidad_medida: "unidad" },
  });
});

/** Una orden pendiente con un material de ese stock y su requerimiento ya entregado en parte. */
async function seedOrder(
  suffix: string,
  { stock, entregada = "0.00" }: { stock: string; entregada?: string },
) {
  const idOrden = `OTR0000000${suffix}`;
  const idMaterial = `MAT0000000${suffix}`;
  const idRequerimiento = `ROM0000000${suffix}`;

  await prisma.material.create({
    data: {
      id_material: idMaterial,
      nombre_material: `Plancha ${suffix}`,
      categoria: "planchas",
      unidad_medida: "unidad",
      stock_actual: stock,
      stock_minimo: "0.00",
      costo_unitario_actual: "10.00",
    },
  });
  await prisma.orden_trabajo.create({
    data: {
      id_orden_trabajo: idOrden,
      id_producto: PRODUCTO,
      tipo_produccion: "reposicion_stock",
      cantidad: "1.00",
      fecha_inicio: new Date("2026-11-10T00:00:00.000Z"),
      estado: "pendiente",
      id_usuario_registro: USUARIO,
    },
  });
  await prisma.requerimiento_orden_material.create({
    data: {
      id_requerimiento: idRequerimiento,
      id_orden_trabajo: idOrden,
      id_material: idMaterial,
      cantidad_por_unidad: "5.00",
      unidad_medida: "unidad",
      tipo_consumo: "directo",
      costo_unitario_registrado: "10.00",
      cantidad_requerida: "5.00",
      cantidad_entregada: entregada,
    },
  });

  return { idOrden, idMaterial, idRequerimiento };
}

async function run(action: (formData: FormData) => Promise<void>, fields: Record<string, string | string[]>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      formData.append(key, item);
    }
  }

  try {
    await action(formData);

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

type StateAction = (
  prevState: { status: "idle" },
  formData: FormData,
) => Promise<{ status: string; error?: string; fieldErrors?: Record<string, string[] | undefined>; data?: unknown }>;

/** Una accion que devuelve su estado, con la clave dada o una nueva. */
async function runState(
  action: StateAction,
  fields: Record<string, string>,
  clave: string = crypto.randomUUID(),
) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({ ...fields, clave_operacion: clave })) {
    formData.set(key, value);
  }

  return action({ status: "idle" }, formData);
}

/** Stock, lo entregado y devuelto, y los movimientos del kardex de ese material. */
async function snapshot(idMaterial: string, idRequerimiento: string) {
  const material = await prisma.material.findUniqueOrThrow({ where: { id_material: idMaterial } });
  const requirement = await prisma.requerimiento_orden_material.findUniqueOrThrow({
    where: { id_requerimiento: idRequerimiento },
  });
  const movements = await prisma.movimiento_inventario.findMany({
    where: { id_material: idMaterial },
    orderBy: { id_movimiento: "asc" },
  });

  return {
    stock: material.stock_actual.toFixed(2),
    entregada: requirement.cantidad_entregada.toFixed(2),
    devuelta: requirement.cantidad_devuelta.toFixed(2),
    kardex: movements.map((movement) => [
      movement.tipo_movimiento,
      movement.cantidad.toFixed(2),
      movement.stock_anterior.toFixed(2),
      movement.stock_resultante.toFixed(2),
    ]),
  };
}

describe("C1 de la 11.6a: cantidades de material en centesimos", () => {
  it("una entrega adicional de 0.005 baja el stock lo mismo que anota el kardex y lo entregado", async () => {
    const { idOrden, idMaterial, idRequerimiento } = await seedOrder("1", { stock: "20.00" });

    expect(
      await runState(deliverAdditionalMaterialAction, {
        id_orden_trabajo: idOrden,
        id_requerimiento: idRequerimiento,
        cantidad: "0.005",
        motivo: "Pieza rota",
      }),
    ).toMatchObject({ status: "success" });

    expect(await snapshot(idMaterial, idRequerimiento)).toEqual({
      stock: "19.99",
      entregada: "0.01",
      devuelta: "0.00",
      kardex: [["salida", "0.01", "20.00", "19.99"]],
    });
  });

  it("una entrega adicional de 10.004 sobre un stock de 10.00 entrega 10.00", async () => {
    const { idOrden, idMaterial, idRequerimiento } = await seedOrder("2", { stock: "10.00" });

    expect(
      await runState(deliverAdditionalMaterialAction, {
        id_orden_trabajo: idOrden,
        id_requerimiento: idRequerimiento,
        cantidad: "10.004",
        motivo: "Pieza rota",
      }),
    ).toMatchObject({ status: "success" });

    expect(await snapshot(idMaterial, idRequerimiento)).toEqual({
      stock: "0.00",
      entregada: "10.00",
      devuelta: "0.00",
      kardex: [["salida", "10.00", "10.00", "0.00"]],
    });
  });

  it("una entrega adicional que se guardaria como 0.00 se rechaza sin escribir", async () => {
    const { idOrden, idMaterial, idRequerimiento } = await seedOrder("3", { stock: "20.00" });

    expect(
      await runState(deliverAdditionalMaterialAction, {
        id_orden_trabajo: idOrden,
        id_requerimiento: idRequerimiento,
        cantidad: "0.004",
        motivo: "Pieza rota",
      }),
    ).toMatchObject({ status: "error", fieldErrors: { cantidad: ["La cantidad debe ser mayor que cero."] } });

    expect(await snapshot(idMaterial, idRequerimiento)).toEqual({
      stock: "20.00",
      entregada: "0.00",
      devuelta: "0.00",
      kardex: [],
    });
  });

  it("una devolucion de 5.004 con 5.00 por devolver devuelve 5.00", async () => {
    const { idOrden, idMaterial, idRequerimiento } = await seedOrder("4", { stock: "15.00", entregada: "5.00" });

    expect(
      await runState(returnWorkOrderMaterialAction, {
        id_orden_trabajo: idOrden,
        id_requerimiento: idRequerimiento,
        cantidad: "5.004",
        motivo: "",
      }),
    ).toMatchObject({ status: "success" });

    expect(await snapshot(idMaterial, idRequerimiento)).toEqual({
      stock: "20.00",
      entregada: "5.00",
      devuelta: "5.00",
      kardex: [["devolucion", "5.00", "15.00", "20.00"]],
    });
  });

  it("el cierre guarda lo producido y la bitacora lo nombra con el mismo redondeo", async () => {
    const { idOrden, idRequerimiento } = await seedOrder("5", { stock: "20.00", entregada: "3.00" });

    expect(
      await run(closeWorkOrderMaterialsAction, {
        id_orden_trabajo: idOrden,
        cantidad_producida: "2.675",
        id_requerimiento: [idRequerimiento],
        cantidad_consumida: ["3.00"],
      }),
    ).toBe(SAVED);

    const order = await prisma.orden_trabajo.findUniqueOrThrow({ where: { id_orden_trabajo: idOrden } });
    const log = await prisma.bitacora_operacion.findFirstOrThrow({
      where: { id_registro_afectado: idOrden, accion: "cerrar_materiales" },
    });

    expect(order.cantidad_producida?.toFixed(2)).toBe("2.68");
    expect(log.detalle).toContain("Producido: 2.68.");
  });
});

// C1 de la 11.6b (D73): el candado de la orden pone en fila dos envios iguales, pero sin clave el
// segundo volvia a validar y movia el stock otra vez. Con la misma clave, el segundo responde con
// el movimiento del primero sin escribir. PGlite atiende una transaccion a la vez: los envios van
// uno tras otro, como un reenvio, no a la vez.
describe("C1 de la 11.6b: la misma clave mueve el stock una sola vez", () => {
  const operationOf = (clave: string) =>
    prisma.operacion_idempotente.findUnique({
      where: { clave },
      select: { tipo_operacion: true, id_registro_resultado: true },
    });

  it("una entrega adicional enviada dos veces con la misma clave saca el stock una vez", async () => {
    const { idOrden, idMaterial, idRequerimiento } = await seedOrder("6", { stock: "20.00" });
    const clave = crypto.randomUUID();
    const fields = { id_orden_trabajo: idOrden, id_requerimiento: idRequerimiento, cantidad: "2", motivo: "Pieza rota" };

    const first = await runState(deliverAdditionalMaterialAction, fields, clave);
    const second = await runState(deliverAdditionalMaterialAction, fields, clave);
    const [movement] = await prisma.movimiento_inventario.findMany({ where: { id_material: idMaterial } });

    expect(first).toMatchObject({ status: "success", data: { id_movimiento: movement.id_movimiento } });
    expect(second).toMatchObject({ status: "success", data: { id_movimiento: movement.id_movimiento } });
    expect(await snapshot(idMaterial, idRequerimiento)).toEqual({
      stock: "18.00",
      entregada: "2.00",
      devuelta: "0.00",
      kardex: [["salida", "2.00", "20.00", "18.00"]],
    });
    expect(await operationOf(clave)).toEqual({
      tipo_operacion: "entrega_adicional_material",
      id_registro_resultado: movement.id_movimiento,
    });
  });

  it("una devolucion parcial enviada dos veces con la misma clave devuelve una vez", async () => {
    const { idOrden, idMaterial, idRequerimiento } = await seedOrder("7", { stock: "10.00", entregada: "10.00" });
    const clave = crypto.randomUUID();
    const fields = { id_orden_trabajo: idOrden, id_requerimiento: idRequerimiento, cantidad: "2", motivo: "" };

    await runState(returnWorkOrderMaterialAction, fields, clave);
    await runState(returnWorkOrderMaterialAction, fields, clave);

    expect(await snapshot(idMaterial, idRequerimiento)).toEqual({
      stock: "12.00",
      entregada: "10.00",
      devuelta: "2.00",
      kardex: [["devolucion", "2.00", "10.00", "12.00"]],
    });
  });

  it("dos devoluciones parciales con claves distintas son dos operaciones y devuelven las dos", async () => {
    const { idOrden, idMaterial, idRequerimiento } = await seedOrder("8", { stock: "10.00", entregada: "10.00" });
    const fields = { id_orden_trabajo: idOrden, id_requerimiento: idRequerimiento, cantidad: "2", motivo: "" };

    await runState(returnWorkOrderMaterialAction, fields);
    await runState(returnWorkOrderMaterialAction, fields);

    expect((await snapshot(idMaterial, idRequerimiento)).devuelta).toBe("4.00");
  });

  it("un rechazo libera la clave: la entrega corregida con la misma clave sale", async () => {
    const { idOrden, idMaterial, idRequerimiento } = await seedOrder("9", { stock: "5.00" });
    const clave = crypto.randomUUID();
    const fields = { id_orden_trabajo: idOrden, id_requerimiento: idRequerimiento, motivo: "Pieza rota" };

    expect(await runState(deliverAdditionalMaterialAction, { ...fields, cantidad: "6" }, clave)).toMatchObject({
      status: "error",
      fieldErrors: { cantidad: [expect.stringContaining("Stock insuficiente")] },
    });
    expect(await operationOf(clave)).toBeNull();

    expect(await runState(deliverAdditionalMaterialAction, { ...fields, cantidad: "4" }, clave)).toMatchObject({
      status: "success",
    });
    expect((await snapshot(idMaterial, idRequerimiento)).stock).toBe("1.00");
  });
});
