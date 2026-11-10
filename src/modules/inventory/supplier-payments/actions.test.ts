import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createSupplierPaymentAction } from "@/modules/inventory/supplier-payments/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion del pago a proveedor (11.2a), escrita antes de tocar la
// accion: hasta aqui no tenia ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la
// bitacora y los correlativos simulados, y fija en un snapshot, en orden: la
// autorizacion con sus roles, las lecturas (y si van fuera de la
// transaccion), la transaccion con sus escrituras y su final, el correlativo,
// la bitacora, las revalidaciones y el resultado: la redireccion o el mensaje
// de error exacto. Mover una lectura dentro de la transaccion, o cambiar el
// saldo o el estado que se guardan, cambia el snapshot.
//
// Los montos de estos casos son exactos en binario o no llegan al borde del
// redondeo: el saldo con decimales (hallazgos 1 y 2 de la 11.2a) tiene sus
// propias pruebas.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock({
    transactions: true,
    recordTransactionEnd: true,
  }),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);
vi.mock("next/cache", async () => {
  const { recordEffect } = await import("@/testing/page-characterization");

  return {
    revalidatePath: (path: string) => recordEffect("revalidatePath", path),
  };
});
vi.mock("@/lib/audit", async () => {
  const { recordEffect } = await import("@/testing/page-characterization");

  return {
    registerAuditLog: async ({ tx, ...data }: Record<string, unknown>) => {
      recordEffect("registerAuditLog", { ...data, enTransaccion: tx !== undefined });
    },
  };
});
vi.mock("@/lib/correlatives-core", async (importOriginal) => {
  const { recordEffect } = await import("@/testing/page-characterization");
  const { formatCorrelativeId } = await import("@/lib/correlatives-format");

  return {
    ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
    getNextCorrelativeId: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string },
    ) => {
      recordEffect("getNextCorrelativeId", params);

      return formatCorrelativeId(params.prefijo, 1);
    },
  };
});

expect.addSnapshotSerializer(decimalSnapshotSerializer);

type FormFields = Record<string, string>;
type ActionCase = { name: string; form?: FormFields; data?: DataOverrides };

const D = (value: string) => new Prisma.Decimal(value);

const COMPRA = "COM00000003";
const PROVEEDOR = "PVE00000001";

const baseForm: FormFields = {
  id_compra: COMPRA,
  fecha_pago: "2026-07-14",
  monto_pagado: "40",
  metodo_pago: "transferencia",
  observaciones: "",
};

function purchaseRow(changes: Record<string, unknown> = {}) {
  return {
    id_compra: COMPRA,
    id_proveedor: PROVEEDOR,
    monto_total: D("100.00"),
    estado_compra: "confirmada",
    estado_pago: "pendiente",
    ...changes,
  };
}

const payments = (...amounts: string[]) =>
  amounts.map((amount) => ({ monto_pagado: D(amount) }));

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  return formData;
}

async function runAction(actionCase: ActionCase) {
  const { calls, result } = await characterizeHandler(async () => {
    try {
      await createSupplierPaymentAction(formOf({ ...baseForm, ...actionCase.form }));

      return "termino sin redirigir";
    } catch (error) {
      return (
        describeNavigationError(error) ??
        `error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, actionCase.data);

  return { calls, outcome: result };
}

const cases: ActionCase[] = [
  {
    name: "primer pago parcial",
    data: {
      "compra.findUnique": purchaseRow(),
      "pago_proveedor.findMany": [],
    },
  },
  {
    name: "pago que completa el saldo",
    form: { monto_pagado: "60", metodo_pago: "efectivo", observaciones: "  saldo final  " },
    data: {
      "compra.findUnique": purchaseRow({ estado_pago: "parcial" }),
      "pago_proveedor.findMany": payments("40.00"),
    },
  },
  {
    name: "datos invalidos",
    form: { monto_pagado: "0" },
  },
  {
    name: "metodo de pago fuera de la lista",
    form: { metodo_pago: "cheque" },
  },
  {
    name: "compra inexistente",
    data: { "compra.findUnique": null },
  },
  {
    name: "compra anulada",
    data: { "compra.findUnique": purchaseRow({ estado_compra: "anulada", estado_pago: "anulada" }) },
  },
  {
    name: "compra ya pagada",
    data: { "compra.findUnique": purchaseRow({ estado_pago: "pagado" }) },
  },
  {
    name: "pago mayor que el saldo",
    form: { monto_pagado: "70" },
    data: {
      "compra.findUnique": purchaseRow({ estado_pago: "parcial" }),
      "pago_proveedor.findMany": payments("40.00"),
    },
  },
];

describe("createSupplierPaymentAction", () => {
  for (const actionCase of cases) {
    it(actionCase.name, async () => {
      const { calls, outcome } = await runAction(actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});

// C3 de la 11.2a: el pago decide con la compra y sus pagos. Los leia antes de
// abrir la transaccion y sin bloqueo: dos pagos simultaneos veian el mismo
// saldo y los dos pasaban, y una anulacion podia confirmar en medio. Ahora la
// compra se bloquea (FOR NO KEY UPDATE, el mismo candado que toma la anulacion)
// antes de leerla, y todo lo que decide va dentro de la transaccion. La prueba
// fija el protocolo; la carrera misma no se reproduce en una prueba unitaria.
describe("C3 de la 11.2a: el pago decide con la compra bloqueada", () => {
  const decides = cases.filter(
    (actionCase) => !["datos invalidos", "metodo de pago fuera de la lista"].includes(actionCase.name),
  );

  it("cubre los 6 casos que leen la compra", () => {
    expect(decides).toHaveLength(6);
  });

  for (const actionCase of decides) {
    it(actionCase.name, async () => {
      const { calls } = await runAction(actionCase);

      expectRowLockedBefore(calls, {
        table: "compra",
        id: COMPRA,
        reads: (call) =>
          call.prisma === "compra.findUnique" || call.prisma === "pago_proveedor.findMany",
      });
    });
  }
});

// Hallazgos 1 y 2 de la 11.2a: el saldo se calculaba con number. Los montos son
// los que una persona escribe; lo que importa es el valor que guarda la
// columna numeric(12, 2), no el tipo de JavaScript.
describe("hallazgos 1 y 2 de la 11.2a: el saldo con decimales", () => {
  const stored = (value: unknown) => new Prisma.Decimal(String(value)).toFixed(2);

  function writeOf(calls: Awaited<ReturnType<typeof runAction>>["calls"], name: string) {
    const call = calls.find((item) => "prisma" in item && item.prisma === name);

    expect(call, `no se llamo a ${name}`).toBeDefined();

    return ((call as { args: { data: Record<string, unknown> } }).args).data;
  }

  it("acepta pagar el saldo exacto: 50.20 de 100.30 tras un pago de 50.10", async () => {
    const { calls, outcome } = await runAction({
      name: "saldo exacto",
      form: { monto_pagado: "50.20" },
      data: {
        "compra.findUnique": purchaseRow({ monto_total: D("100.30"), estado_pago: "parcial" }),
        "pago_proveedor.findMany": payments("50.10"),
      },
    });

    expect(outcome).toBe(
      `redirect:/dashboard/inventory/purchases/${COMPRA}?toast=supplier-payment-registered`,
    );

    const payment = writeOf(calls, "pago_proveedor.create");

    expect(stored(payment.saldo_pendiente)).toBe("0.00");
    expect(payment.estado_pago).toBe("pagado");
    expect(writeOf(calls, "compra.update").estado_pago).toBe("pagado");
  });

  it("deja pagada la compra cuyo ultimo pago cubre el saldo: 34.23 de 1234.56", async () => {
    const { calls } = await runAction({
      name: "saldo con residuo",
      form: { monto_pagado: "34.23" },
      data: {
        "compra.findUnique": purchaseRow({ monto_total: D("1234.56"), estado_pago: "parcial" }),
        "pago_proveedor.findMany": payments("1000.11", "200.22"),
      },
    });

    const payment = writeOf(calls, "pago_proveedor.create");

    expect(stored(payment.saldo_pendiente)).toBe("0.00");
    expect(payment.estado_pago).toBe("pagado");
    expect(writeOf(calls, "compra.update").estado_pago).toBe("pagado");
  });

  it("rechaza un centimo por encima del saldo y muestra el saldo exacto", async () => {
    const { calls, outcome } = await runAction({
      name: "un centimo de mas",
      form: { monto_pagado: "50.21" },
      data: {
        "compra.findUnique": purchaseRow({ monto_total: D("100.30"), estado_pago: "parcial" }),
        "pago_proveedor.findMany": payments("50.10"),
      },
    });

    expect(outcome).toBe(
      "error: El pago no puede superar el saldo pendiente. Saldo actual: S/ 50.20",
    );
    expect(calls.some((item) => "prisma" in item && item.prisma === "pago_proveedor.create")).toBe(
      false,
    );
  });
});
