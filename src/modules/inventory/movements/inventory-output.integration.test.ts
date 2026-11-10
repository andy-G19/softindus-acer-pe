import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createInventoryOutputAction } from "@/modules/inventory/movements/actions";
import { getTestDatabase } from "@/testing/test-database";

// La salida de inventario contra Postgres real (PGlite), 11.2c. Corre la accion entera: la
// clave de la operacion, el bloqueo del material (su SQL se ejecuta de verdad), la cantidad
// redondeada como la columna, el kardex, la bitacora y el rollback de un rechazo. Solo se
// reemplazan la sesion y la cache de Next.
//
// Lo que no se puede probar aqui: dos salidas simultaneas del mismo material o con la misma
// clave. En Postgres la segunda espera el bloqueo de la primera; PGlite atiende una sola
// transaccion a la vez (test-database.ts). Los reenvios van uno tras otro.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";
const PLANCHA = "MAT00000001";
const TUBO = "MAT00000002";
const ANGULO = "MAT00000003";

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
  await prisma.material.create({
    data: {
      id_material: PLANCHA,
      nombre_material: "Plancha 3 mm",
      categoria: "plancha",
      unidad_medida: "UND",
      stock_actual: "20",
    },
  });
});

function outputForm(cantidad: string, clave: string = randomUUID(), material: string = PLANCHA) {
  const formData = new FormData();

  formData.set("id_material", material);
  formData.set("id_orden_trabajo", "");
  formData.set("clave_operacion", clave);
  formData.set("cantidad", cantidad);
  formData.set("motivo", "Corte de prueba");

  return formData;
}

const stockOf = async () =>
  (await prisma.material.findUniqueOrThrow({ where: { id_material: PLANCHA }, select: { stock_actual: true } })).stock_actual.toFixed(2);

describe("salida de inventario en Postgres", () => {
  it("descuenta la cantidad redondeada y el kardex cuadra: 1.005 sobre 20.00", async () => {
    const state = await createInventoryOutputAction({ status: "idle" }, outputForm("1.005"));

    expect(state).toMatchObject({ status: "success" });

    const idMovimiento = (state as { data: { id_movimiento: string } }).data.id_movimiento;
    const kardex = await prisma.movimiento_inventario.findUniqueOrThrow({ where: { id_movimiento: idMovimiento } });

    expect([kardex.cantidad.toFixed(2), kardex.stock_anterior.toFixed(2), kardex.stock_resultante.toFixed(2)]).toEqual([
      "1.01",
      "20.00",
      "18.99",
    ]);
    expect(await stockOf()).toBe("18.99");
  });

  it("la misma clave dos veces deja una sola salida y descuenta el stock una vez", async () => {
    const clave = randomUUID();
    const before = Number(await stockOf());
    const movimientosAntes = await prisma.movimiento_inventario.count();

    const first = await createInventoryOutputAction({ status: "idle" }, outputForm("2", clave));
    const second = await createInventoryOutputAction({ status: "idle" }, outputForm("2", clave));

    expect(first).toMatchObject({ status: "success", data: { clave_operacion: clave } });
    expect(second).toMatchObject({ status: "success", data: (first as { data: unknown }).data });
    expect(await prisma.movimiento_inventario.count()).toBe(movimientosAntes + 1);
    expect(Number(await stockOf())).toBe(before - 2);
    expect(
      await prisma.operacion_idempotente.findUnique({
        where: { clave },
        select: { tipo_operacion: true, id_registro_resultado: true },
      }),
    ).toEqual({
      tipo_operacion: "registrar_salida",
      id_registro_resultado: (first as { data: { id_movimiento: string } }).data.id_movimiento,
    });
  });

  it("sin stock suficiente se rechaza en su campo, no escribe nada y libera la clave", async () => {
    const clave = randomUUID();
    const before = await stockOf();
    const movimientosAntes = await prisma.movimiento_inventario.count();

    const state = await createInventoryOutputAction({ status: "idle" }, outputForm("500", clave));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { cantidad: ["No hay stock suficiente para registrar la salida."] },
    });
    expect(await stockOf()).toBe(before);
    expect(await prisma.movimiento_inventario.count()).toBe(movimientosAntes);
    expect(await prisma.operacion_idempotente.count({ where: { clave } })).toBe(0);
  });
});

// C4 de la 11.2c (D16): la salida aplica la regla de alertas de stock de la entrega a una orden.
describe("alertas de stock tras una salida en Postgres", () => {
  beforeAll(async () => {
    await prisma.material.createMany({
      data: [
        { id_material: TUBO, nombre_material: "Tubo 2 pulgadas", categoria: "tubo", unidad_medida: "UND", stock_actual: "10", stock_minimo: "5" },
        { id_material: ANGULO, nombre_material: "Angulo 1 pulgada", categoria: "angulo", unidad_medida: "UND", stock_actual: "20", stock_minimo: "5" },
      ],
    });
  });

  const activas = (idMaterial: string) =>
    prisma.alerta_stock.findMany({
      where: { id_material: idMaterial, estado_alerta: "activa" },
      select: { stock_detectado: true, stock_minimo: true, mensaje: true },
    });

  it("al llegar al minimo abre la alerta y una segunda salida actualiza la misma", async () => {
    expect(await createInventoryOutputAction({ status: "idle" }, outputForm("5", randomUUID(), TUBO))).toMatchObject({ status: "success" });

    const [abierta, ...otras] = await activas(TUBO);

    expect(otras).toEqual([]);
    expect([abierta.stock_detectado.toFixed(2), abierta.stock_minimo.toFixed(2), abierta.mensaje]).toEqual([
      "5.00",
      "5.00",
      "El material Tubo 2 pulgadas quedo en stock critico tras una salida de inventario.",
    ]);

    expect(await createInventoryOutputAction({ status: "idle" }, outputForm("1.5", randomUUID(), TUBO))).toMatchObject({ status: "success" });

    const despues = await activas(TUBO);

    expect(despues.map((alerta) => alerta.stock_detectado.toFixed(2))).toEqual(["3.50"]);
  });

  it("por encima del minimo atiende la alerta activa que hubiera", async () => {
    await prisma.alerta_stock.create({
      data: { id_alerta: "ALE00000900", id_material: ANGULO, stock_detectado: "4", stock_minimo: "5", mensaje: "Alerta previa" },
    });

    expect(await createInventoryOutputAction({ status: "idle" }, outputForm("2", randomUUID(), ANGULO))).toMatchObject({ status: "success" });

    const alerta = await prisma.alerta_stock.findUniqueOrThrow({ where: { id_alerta: "ALE00000900" } });

    expect([alerta.estado_alerta, alerta.stock_detectado.toFixed(2), alerta.id_usuario_atencion, alerta.fecha_atencion !== null]).toEqual([
      "atendida",
      "18.00",
      USUARIO,
      true,
    ]);
  });
});
