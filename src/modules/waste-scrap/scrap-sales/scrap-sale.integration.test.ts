import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createScrapSaleAction } from "@/modules/waste-scrap/scrap-sales/actions";
import { getTestDatabase } from "@/testing/test-database";

// La venta de chatarra contra Postgres real (PGlite), C3 de la 11.4b. Corre la accion entera: los
// candados de la chatarra y de la caja (su SQL se ejecuta de verdad sobre las tablas), el monto
// redondeado como las columnas (C2), los correlativos, la bitacora y el rollback de un rechazo.
// Solo se reemplazan la sesion y la cache de Next. Desde C4 de la 11.4b la venta devuelve su
// resultado: «guardado» o su error.
//
// Lo que no se puede probar aqui: dos ventas simultaneas de la misma chatarra. En Postgres la
// segunda espera el candado de la primera; PGlite atiende una sola transaccion a la vez
// (test-database.ts). Las repeticiones van una tras otra.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";
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
});

async function createScrap(idChatarra: string) {
  await prisma.chatarra.create({
    data: {
      id_chatarra: idChatarra,
      tipo_material: "Retazos de plancha",
      peso_kg: "15.00",
      cantidad: "3.00",
      estado: "acumulada",
    },
  });
}

async function createBox(idCajaChica: string, saldo: string) {
  await prisma.caja_chica.create({
    data: {
      id_caja_chica: idCajaChica,
      nombre_caja: `Caja ${idCajaChica}`,
      saldo_inicial: saldo,
      saldo_actual: saldo,
      estado: "abierta",
    },
  });
}

async function sell(idChatarra: string, fields: Record<string, string>, clave: string = randomUUID()) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
    clave_operacion: clave,
    id_chatarra: idChatarra,
    id_caja_chica: "",
    fecha_venta: "2026-11-10",
    cantidad_vendida: "",
    peso_vendido_kg: "",
    monto_recibido: "50.00",
    destino_dinero: "",
    observaciones: "",
    ...fields,
  })) {
    formData.set(key, value);
  }

  const state = await createScrapSaleAction({ status: "idle" }, formData);

  return state.status === "success" ? "guardado" : state.status === "error" ? state.error : "sin respuesta";
}

const balanceOf = async (idCajaChica: string) =>
  (
    await prisma.caja_chica.findUniqueOrThrow({ where: { id_caja_chica: idCajaChica }, select: { saldo_actual: true } })
  ).saldo_actual.toFixed(2);

describe("venta de chatarra en Postgres", () => {
  it("vender dos veces la misma chatarra deja una sola venta y un solo ingreso", async () => {
    await createScrap("CHA00000001");
    await createBox("CAJ00000001", "100.00");

    expect(await sell("CHA00000001", { id_caja_chica: "CAJ00000001", monto_recibido: "80.005" })).toBe(SAVED);
    expect(await sell("CHA00000001", { id_caja_chica: "CAJ00000001", monto_recibido: "80.005" })).toBe(
      "Esta chatarra ya fue vendida.",
    );

    const sales = await prisma.venta_chatarra.findMany({
      where: { id_chatarra: "CHA00000001" },
      select: { monto_recibido: true, peso_vendido_kg: true, id_movimiento_caja: true },
    });

    expect(sales.map((sale) => [sale.monto_recibido.toFixed(2), sale.peso_vendido_kg?.toFixed(2)])).toEqual([
      ["80.01", "15.00"],
    ]);
    expect(await balanceOf("CAJ00000001")).toBe("180.01");

    const movements = await prisma.movimiento_caja.findMany({
      where: { id_caja_chica: "CAJ00000001" },
      select: { id_movimiento_caja: true, monto: true, tipo_movimiento: true },
    });

    expect(movements.map((movement) => [movement.tipo_movimiento, movement.monto.toFixed(2)])).toEqual([
      ["ingreso", "80.01"],
    ]);
    expect(sales[0].id_movimiento_caja).toBe(movements[0].id_movimiento_caja);
    expect(
      (await prisma.chatarra.findUniqueOrThrow({ where: { id_chatarra: "CHA00000001" }, select: { estado: true } }))
        .estado,
    ).toBe("vendida");
  });

  it("la misma clave dos veces deja una sola venta y suma el ingreso una vez (C4)", async () => {
    await createScrap("CHA00000003");
    await createBox("CAJ00000003", "10.00");
    const clave = randomUUID();

    expect(await sell("CHA00000003", { id_caja_chica: "CAJ00000003", monto_recibido: "25.00" }, clave)).toBe(SAVED);
    expect(await sell("CHA00000003", { id_caja_chica: "CAJ00000003", monto_recibido: "25.00" }, clave)).toBe(SAVED);
    expect(await prisma.venta_chatarra.count({ where: { id_chatarra: "CHA00000003" } })).toBe(1);
    expect(await balanceOf("CAJ00000003")).toBe("35.00");
  });

  it("una venta en una caja cerrada no escribe nada: ni venta, ni movimiento, ni chatarra vendida", async () => {
    await createScrap("CHA00000002");
    await createBox("CAJ00000002", "20.00");
    await prisma.caja_chica.update({ where: { id_caja_chica: "CAJ00000002" }, data: { estado: "cerrada" } });

    expect(await sell("CHA00000002", { id_caja_chica: "CAJ00000002" })).toBe(
      "Solo se puede registrar el ingreso en una caja abierta.",
    );
    expect(await prisma.venta_chatarra.count({ where: { id_chatarra: "CHA00000002" } })).toBe(0);
    expect(await prisma.movimiento_caja.count({ where: { id_caja_chica: "CAJ00000002" } })).toBe(0);
    expect(await balanceOf("CAJ00000002")).toBe("20.00");
    expect(
      (await prisma.chatarra.findUniqueOrThrow({ where: { id_chatarra: "CHA00000002" }, select: { estado: true } }))
        .estado,
    ).toBe("acumulada");
  });
});
