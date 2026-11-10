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

function outputForm(cantidad: string, clave: string = randomUUID()) {
  const formData = new FormData();

  formData.set("id_material", PLANCHA);
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
