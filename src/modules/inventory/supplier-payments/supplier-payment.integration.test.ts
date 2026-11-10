import { beforeAll, describe, expect, it, vi } from "vitest";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { annulPurchaseAction } from "@/modules/inventory/purchases/actions";
import { createSupplierPaymentAction } from "@/modules/inventory/supplier-payments/actions";
import { getTestDatabase } from "@/testing/test-database";

// El pago a proveedor y la anulacion de compra contra Postgres real (PGlite),
// 11.2a. Corre la accion entera: el bloqueo de la compra (su SQL se ejecuta de
// verdad), las lecturas dentro de la transaccion, el correlativo, la bitacora y
// el rollback de un rechazo. Solo se reemplazan la sesion y Next (cache y
// redireccion).
//
// Lo que no se puede probar aqui: dos pagos simultaneos sobre la misma compra.
// En Postgres el segundo espera el candado del primero y decide con su saldo ya
// confirmado; PGlite atiende una sola transaccion a la vez (test-database.ts).
// El orden del bloqueo lo fija expectRowLockedBefore en actions.test.ts.

const mocks = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(readonly url: string) {
      super(`redirect: ${url}`);
    }
  }

  return { RedirectSignal };
});

vi.mock("@/lib/authz", () => ({
  requireRole: async () => ({ user: { id: "USU00000001" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new mocks.RedirectSignal(url);
  },
}));

const USUARIO = "USU00000001";
const PROVEEDOR = "PVE00000001";
const MATERIAL = "MAT00000001";

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
  await prisma.proveedor.create({
    data: { id_proveedor: PROVEEDOR, razon_social: "Aceros del Sur", tipo_proveedor: "material" },
  });
  await prisma.material.create({
    data: {
      id_material: MATERIAL,
      nombre_material: "Plancha 3 mm",
      categoria: "plancha",
      unidad_medida: "UND",
      stock_actual: "15",
    },
  });
});

/** Una compra confirmada con sus pagos previos. Los ids de pago no chocan con el correlativo. */
async function seedPurchase(idCompra: string, total: string, pagos: string[] = []) {
  await prisma.compra.create({
    data: {
      id_compra: idCompra,
      id_proveedor: PROVEEDOR,
      id_usuario_registro: USUARIO,
      fecha_compra: new Date("2026-07-01"),
      subtotal: total,
      igv: 0,
      monto_total: total,
      estado_pago: pagos.length > 0 ? "parcial" : "pendiente",
      estado_compra: "confirmada",
    },
  });

  for (const [index, monto] of pagos.entries()) {
    await prisma.pago_proveedor.create({
      data: {
        id_pago_proveedor: `PPR${idCompra.slice(-5)}${String(index + 1).padStart(3, "0")}`,
        id_compra: idCompra,
        id_proveedor: PROVEEDOR,
        id_usuario_registro: USUARIO,
        fecha_pago: new Date("2026-07-02"),
        monto_pagado: monto,
        metodo_pago: "efectivo",
        saldo_pendiente: new Prisma.Decimal(total).minus(monto),
        estado_pago: "parcial",
      },
    });
  }
}

function paymentForm(idCompra: string, monto: string) {
  const formData = new FormData();

  formData.set("id_compra", idCompra);
  formData.set("fecha_pago", "2026-07-14");
  formData.set("monto_pagado", monto);
  formData.set("metodo_pago", "transferencia");
  formData.set("observaciones", "");

  return formData;
}

async function outcomeOf(action: Promise<unknown>) {
  try {
    await action;
    return "termino sin redirigir";
  } catch (error) {
    if (error instanceof mocks.RedirectSignal) {
      return `redirect:${error.url}`;
    }

    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function purchaseState(idCompra: string) {
  return prisma.compra.findUniqueOrThrow({
    where: { id_compra: idCompra },
    select: { estado_compra: true, estado_pago: true },
  });
}

function paymentsOf(idCompra: string) {
  return prisma.pago_proveedor.findMany({
    where: { id_compra: idCompra },
    orderBy: { id_pago_proveedor: "asc" },
    select: { id_pago_proveedor: true, monto_pagado: true, saldo_pendiente: true, estado_pago: true },
  });
}

describe("pago a proveedor en Postgres", () => {
  it("paga el saldo exacto: 50.20 de 100.30 tras 50.10 deja la compra pagada", async () => {
    await seedPurchase("COM00000101", "100.30", ["50.10"]);

    const outcome = await outcomeOf(createSupplierPaymentAction(paymentForm("COM00000101", "50.20")));

    expect(outcome).toBe(
      "redirect:/dashboard/inventory/purchases/COM00000101?toast=supplier-payment-registered",
    );
    expect(await purchaseState("COM00000101")).toEqual({
      estado_compra: "confirmada",
      estado_pago: "pagado",
    });

    // El sembrado es PPR00101001; el nuevo sale del correlativo.
    const pagos = await paymentsOf("COM00000101");
    const nuevo = pagos.find((pago) => pago.id_pago_proveedor !== "PPR00101001");

    expect(pagos).toHaveLength(2);
    expect(nuevo?.id_pago_proveedor).toBe("PPR00000001");
    if (!nuevo) return;

    expect(nuevo.monto_pagado.toFixed(2)).toBe("50.20");
    expect(nuevo.saldo_pendiente.toFixed(2)).toBe("0.00");
    expect(nuevo.estado_pago).toBe("pagado");
    expect(
      await prisma.bitacora_operacion.count({
        where: { entidad_afectada: "pago_proveedor", detalle: { contains: "COM00000101" } },
      }),
    ).toBe(1);
  });

  it("un pago mayor que el saldo no escribe nada: ni pago, ni estado, ni bitacora", async () => {
    await seedPurchase("COM00000102", "100.30", ["50.10"]);
    const bitacoraAntes = await prisma.bitacora_operacion.count();

    const outcome = await outcomeOf(createSupplierPaymentAction(paymentForm("COM00000102", "50.21")));

    expect(outcome).toBe(
      "error: El pago no puede superar el saldo pendiente. Saldo actual: S/ 50.20",
    );
    expect(await paymentsOf("COM00000102")).toHaveLength(1);
    expect(await purchaseState("COM00000102")).toEqual({
      estado_compra: "confirmada",
      estado_pago: "parcial",
    });
    expect(await prisma.bitacora_operacion.count()).toBe(bitacoraAntes);
  });

  it("no registra pagos en una compra anulada", async () => {
    await seedPurchase("COM00000103", "80.00");
    await prisma.compra.update({
      where: { id_compra: "COM00000103" },
      data: { estado_compra: "anulada", estado_pago: "anulada" },
    });

    const outcome = await outcomeOf(createSupplierPaymentAction(paymentForm("COM00000103", "10")));

    expect(outcome).toBe("error: No se puede registrar pagos en una compra anulada.");
    expect(await paymentsOf("COM00000103")).toHaveLength(0);
  });
});

describe("anulacion de compra en Postgres", () => {
  it("rechaza anular una compra con pagos y no toca el stock", async () => {
    await seedPurchase("COM00000104", "100.30", ["50.10"]);
    const stockAntes = await prisma.material.findUniqueOrThrow({
      where: { id_material: MATERIAL },
      select: { stock_actual: true },
    });
    const formData = new FormData();
    formData.set("id_compra", "COM00000104");

    const outcome = await outcomeOf(annulPurchaseAction(formData));

    expect(outcome).toBe("redirect:/dashboard/inventory/purchases/COM00000104");
    expect(await purchaseState("COM00000104")).toEqual({
      estado_compra: "confirmada",
      estado_pago: "parcial",
    });
    expect(
      await prisma.material.findUniqueOrThrow({
        where: { id_material: MATERIAL },
        select: { stock_actual: true },
      }),
    ).toEqual(stockAntes);
  });
});
