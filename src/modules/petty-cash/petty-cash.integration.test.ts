import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createPettyCashBoxAction } from "@/modules/petty-cash/boxes/actions";
import { createPettyCashExpenseAction } from "@/modules/petty-cash/expenses/actions";
import { createPettyCashIncomeAdjustmentAction } from "@/modules/petty-cash/income-adjustments/actions";
import { annulPettyCashMovementAction } from "@/modules/petty-cash/movements/actions";
import { getTestDatabase } from "@/testing/test-database";

// Caja chica contra Postgres real (PGlite), C3 de la 11.4a. Corre las acciones enteras: los
// candados de la caja y del movimiento (su SQL se ejecuta de verdad sobre las tablas), los montos
// redondeados como las columnas (C2), el correlativo, la bitacora y el rollback de un rechazo.
// Solo se reemplazan la sesion, la cache y la navegacion de Next: la redireccion final se
// devuelve como texto.
//
// Lo que no se puede probar aqui: dos egresos o dos anulaciones simultaneos. En Postgres el
// segundo espera el candado del primero; PGlite atiende una sola transaccion a la vez
// (test-database.ts). Las repeticiones van una tras otra.

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
  getAuthorizedSession: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const USUARIO = "USU00000001";
const CATEGORIA = "CGA00000001";

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
  await prisma.categoria_gasto.create({
    data: { id_categoria_gasto: CATEGORIA, nombre_categoria: "Movilidad" },
  });
});

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

function formOf(fields: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({ comprobante: "", responsable: "", observaciones: "", ...fields })) {
    formData.set(key, value);
  }

  return formData;
}

/** Ejecuta la accion y devuelve su redireccion o su error, como texto. */
async function outcome(run: () => Promise<unknown>) {
  try {
    await run();

    return "termino sin redirigir";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** El egreso devuelve el estado del formulario (C5 de la 11.4a): «guardado» o su error. */
const expense = async (idCajaChica: string, monto: string, clave: string = randomUUID()) => {
  const state = await createPettyCashExpenseAction(
    { status: "idle" },
    formOf({
      clave_operacion: clave,
      id_caja_chica: idCajaChica,
      id_categoria_gasto: CATEGORIA,
      concepto: "Taxi a proveedor",
      monto,
      fecha_movimiento: "2026-11-10",
    }),
  );

  return state.status === "success" ? "guardado" : state.status === "error" ? state.error : "sin respuesta";
};

/** El ingreso devuelve el estado del formulario (C6 de la 11.4a): «guardado» o su error. */
const income = async (idCajaChica: string, monto: string, clave: string = randomUUID()) => {
  const state = await createPettyCashIncomeAdjustmentAction(
    { status: "idle" },
    formOf({
      clave_operacion: clave,
      id_caja_chica: idCajaChica,
      tipo_operacion: "ingreso",
      concepto: "Reposicion de caja",
      monto,
      fecha_movimiento: "2026-11-10",
    }),
  );

  return state.status === "success" ? "guardado" : state.status === "error" ? state.error : "sin respuesta";
};

const annul = (idMovimientoCaja: string) =>
  outcome(() => annulPettyCashMovementAction(formOf({ id_movimiento_caja: idMovimientoCaja })));

const balanceOf = async (idCajaChica: string) =>
  (
    await prisma.caja_chica.findUniqueOrThrow({ where: { id_caja_chica: idCajaChica }, select: { saldo_actual: true } })
  ).saldo_actual.toFixed(2);

const movementsOf = async (idCajaChica: string) =>
  (
    await prisma.movimiento_caja.findMany({
      where: { id_caja_chica: idCajaChica },
      orderBy: { id_movimiento_caja: "asc" },
      select: { id_movimiento_caja: true, tipo_movimiento: true, monto: true, observaciones: true },
    })
  ).map((movement) => ({ ...movement, monto: movement.monto.toFixed(2) }));

describe("caja chica en Postgres", () => {
  it("un egreso de 40.005 guarda 40.01 en el movimiento y descuenta 40.01 del saldo (C2)", async () => {
    await createBox("CAJ00000001", "100.00");

    expect(await expense("CAJ00000001", "40.005")).toBe("guardado");
    expect(await balanceOf("CAJ00000001")).toBe("59.99");
    expect((await movementsOf("CAJ00000001")).map((movement) => movement.monto)).toEqual(["40.01"]);
  });

  it("anular dos veces el mismo egreso devuelve el monto una sola vez", async () => {
    await createBox("CAJ00000002", "100.00");

    expect(await expense("CAJ00000002", "40.25")).toBe("guardado");
    const [movement] = await movementsOf("CAJ00000002");

    expect(await balanceOf("CAJ00000002")).toBe("59.75");
    expect(await annul(movement.id_movimiento_caja)).toBe(
      "redirect:/dashboard/petty-cash/movements?toast=petty-cash-movement-annulled",
    );
    expect(await balanceOf("CAJ00000002")).toBe("100.00");

    expect(await annul(movement.id_movimiento_caja)).toBe("No se puede anular un movimiento ya anulado.");
    expect(await balanceOf("CAJ00000002")).toBe("100.00");

    const [annulled] = await movementsOf("CAJ00000002");

    expect(annulled.monto).toBe("0.00");
    expect(annulled.observaciones).toContain("[ANULADO]");
    expect(annulled.observaciones).toContain("Monto original: S/ 40.25.");
  });

  it("un egreso que supera el saldo no escribe nada", async () => {
    await createBox("CAJ00000003", "30.00");

    expect(await expense("CAJ00000003", "30.01")).toBe(
      "El egreso supera el saldo disponible de la caja. Saldo actual: S/ 30.00.",
    );
    expect(await balanceOf("CAJ00000003")).toBe("30.00");
    expect(await movementsOf("CAJ00000003")).toEqual([]);
  });

  it("anular un ingreso que la caja ya gasto se rechaza y no toca el saldo", async () => {
    await createBox("CAJ00000004", "0.00");

    expect(await income("CAJ00000004", "50.00")).toBe("guardado");
    expect(await expense("CAJ00000004", "20.00")).toBe("guardado");
    const [ingreso] = await movementsOf("CAJ00000004");

    expect(await annul(ingreso.id_movimiento_caja)).toBe(
      "No se puede anular el ingreso porque la caja no tiene saldo suficiente para revertirlo.",
    );
    expect(await balanceOf("CAJ00000004")).toBe("30.00");
    expect((await movementsOf("CAJ00000004")).map((movement) => movement.monto)).toEqual(["50.00", "20.00"]);
  });

  it("la misma clave dos veces deja un solo egreso y descuenta el saldo una vez (C5)", async () => {
    await createBox("CAJ00000006", "100.00");
    const clave = randomUUID();

    expect(await expense("CAJ00000006", "30.00", clave)).toBe("guardado");
    expect(await expense("CAJ00000006", "30.00", clave)).toBe("guardado");
    expect(await balanceOf("CAJ00000006")).toBe("70.00");
    expect((await movementsOf("CAJ00000006")).map((movement) => movement.monto)).toEqual(["30.00"]);
  });

  it("un egreso rechazado libera la clave: corregido, se guarda con la misma (C5)", async () => {
    await createBox("CAJ00000007", "50.00");
    const clave = randomUUID();

    expect(await expense("CAJ00000007", "60.00", clave)).toBe(
      "El egreso supera el saldo disponible de la caja. Saldo actual: S/ 50.00.",
    );
    expect(await expense("CAJ00000007", "45.00", clave)).toBe("guardado");
    expect(await balanceOf("CAJ00000007")).toBe("5.00");
    expect((await movementsOf("CAJ00000007")).map((movement) => movement.monto)).toEqual(["45.00"]);
  });

  it("la misma clave dos veces deja un solo ingreso y aumenta el saldo una vez (C6)", async () => {
    await createBox("CAJ00000008", "10.00");
    const clave = randomUUID();

    expect(await income("CAJ00000008", "25.00", clave)).toBe("guardado");
    expect(await income("CAJ00000008", "25.00", clave)).toBe("guardado");
    expect(await balanceOf("CAJ00000008")).toBe("35.00");
    expect((await movementsOf("CAJ00000008")).map((movement) => movement.monto)).toEqual(["25.00"]);
  });

  it("la clave de un egreso no sirve para un ingreso (C6)", async () => {
    await createBox("CAJ00000009", "10.00");
    const clave = randomUUID();

    expect(await expense("CAJ00000009", "5.00", clave)).toBe("guardado");
    expect(await income("CAJ00000009", "5.00", clave)).toBe("La clave de la operacion ya se uso en otra operacion.");
    expect(await balanceOf("CAJ00000009")).toBe("5.00");
  });

  it("abrir una caja con un nombre que ya existe, con otras mayusculas, se rechaza en su campo (C7)", async () => {
    const open = (nombre: string) =>
      createPettyCashBoxAction(
        { status: "idle" },
        formOf({ nombre_caja: nombre, saldo_inicial: "80.405", fecha_apertura: "2026-11-10" }),
      );

    // Los casos anteriores crean sus cajas con ids fijos (CAJ00000001 y siguientes) sin pasar por el
    // correlativo: se adelanta para que la accion no repita uno de esos ids.
    await prisma.correlativo_sistema.update({
      where: { codigo_entidad: "caja_chica" },
      data: { ultimo_numero: 100 },
    });

    expect(await open("Caja almacen norte")).toMatchObject({ status: "success" });
    expect(await open("  CAJA ALMACEN NORTE ")).toMatchObject({
      status: "error",
      fieldErrors: { nombre_caja: ["Ya existe una caja chica con ese nombre."] },
    });

    const boxes = await prisma.caja_chica.findMany({
      where: { nombre_caja: { equals: "caja almacen norte", mode: "insensitive" } },
      select: { saldo_inicial: true, saldo_actual: true, estado: true },
    });

    expect(boxes.map((box) => [box.saldo_inicial.toFixed(2), box.saldo_actual.toFixed(2), box.estado])).toEqual([
      ["80.41", "80.41", "abierta"],
    ]);
  });

  it("el ingreso de una venta de chatarra no se anula desde caja chica (C4, D45)", async () => {
    await createBox("CAJ00000005", "10.00");

    expect(await income("CAJ00000005", "35.50")).toBe("guardado");
    const [ingreso] = await movementsOf("CAJ00000005");

    await prisma.chatarra.create({
      data: { id_chatarra: "CHA00000001", tipo_material: "Retazos de plancha", estado: "vendida" },
    });
    await prisma.venta_chatarra.create({
      data: {
        id_venta_chatarra: "VCH00000001",
        id_chatarra: "CHA00000001",
        id_movimiento_caja: ingreso.id_movimiento_caja,
        monto_recibido: "35.50",
        id_usuario_registro: USUARIO,
      },
    });

    expect(await annul(ingreso.id_movimiento_caja)).toBe(
      "Este ingreso es de la venta de chatarra VCH00000001; no se anula desde caja chica.",
    );
    expect(await balanceOf("CAJ00000005")).toBe("45.50");
    expect((await movementsOf("CAJ00000005")).map((movement) => [movement.monto, movement.observaciones])).toEqual([
      ["35.50", null],
    ]);
  });
});
