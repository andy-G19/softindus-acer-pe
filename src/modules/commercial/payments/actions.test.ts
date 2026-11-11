import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createPaymentAction } from "@/modules/commercial/payments/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion del pago de cliente (C1 de la 11.3a), escrita antes de tocar la accion:
// hasta aqui no tenia ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion con sus roles, la
// lectura de la proforma dentro de la transaccion (hoy sin bloquearla), el correlativo, las
// escrituras, la bitacora, el final de la transaccion, las revalidaciones y el resultado: la
// redireccion o el error exacto.
//
// Los montos de estos casos son exactos en binario: un pago que se guardaria como 0.00
// (hallazgo 2 de la 11.3a) tiene su propia prueba.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

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
    getNextCorrelativeId: async (_tx: unknown, params: { codigoEntidad: string; prefijo: string }) => {
      recordEffect("getNextCorrelativeId", params);

      const next = (mocks.correlatives.get(params.prefijo) ?? 0) + 1;

      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

expect.addSnapshotSerializer(decimalSnapshotSerializer);

const D = (value: string) => new Prisma.Decimal(value);

const PROFORMA = "PRF00000007";

type ActionCase = {
  name: string;
  form: Record<string, string>;
  data?: DataOverrides;
  role?: "ADMIN" | "SELLER" | "WORKSHOP_MASTER";
};

/** Proforma aceptada con 100.00 de saldo. */
function quoteRow(changes: Record<string, unknown> = {}) {
  return {
    id_proforma: PROFORMA,
    id_pedido: "PED00000004",
    saldo: D("100.00"),
    estado: "aceptada",
    ...changes,
  };
}

const form = (changes: Record<string, string> = {}) => ({
  id_proforma: PROFORMA,
  monto_pagado: "40.25",
  metodo_pago: "yape",
  tipo_pago: "amortizacion",
  observaciones: "",
  ...changes,
});

async function runAction(actionCase: ActionCase) {
  mocks.correlatives.clear();

  const formData = new FormData();

  for (const [key, value] of Object.entries(actionCase.form)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        await createPaymentAction(formData);

        return "termino sin redirigir";
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { "proforma.findUnique": quoteRow(), ...actionCase.data },
    { role: actionCase.role ?? "SELLER" },
  );

  return { calls, outcome: result };
}

const cases: ActionCase[] = ([
  { name: "pago parcial: deja el saldo y la proforma aceptada" },
  {
    name: "pago de todo el saldo: deja la proforma pagada",
    form: form({ monto_pagado: "100", tipo_pago: "cancelacion", observaciones: "  cancela en caja  " }),
  },
  {
    name: "primer pago de una proforma vigente: pasa a aceptada",
    data: { "proforma.findUnique": quoteRow({ estado: "vigente" }) },
  },
  { name: "la proforma no existe", data: { "proforma.findUnique": null } },
  { name: "proforma anulada", data: { "proforma.findUnique": quoteRow({ estado: "anulada" }) } },
  { name: "proforma pagada", data: { "proforma.findUnique": quoteRow({ estado: "pagada", saldo: D("0.00") }) } },
  {
    name: "saldo cero con la proforma aceptada: la da por pagada",
    data: { "proforma.findUnique": quoteRow({ saldo: D("0.00") }) },
  },
  { name: "el pago supera el saldo", form: form({ monto_pagado: "100.25" }) },
  { name: "monto cero", form: form({ monto_pagado: "0" }) },
  { name: "metodo de pago invalido", form: form({ metodo_pago: "cheque" }) },
  { name: "sin permiso: el maestro de taller", role: "WORKSHOP_MASTER" },
] satisfies (Omit<ActionCase, "form"> & { form?: ActionCase["form"] })[]).map((actionCase) => ({
  form: form(),
  ...actionCase,
}));

describe("createPaymentAction", () => {
  for (const actionCase of cases) {
    it(actionCase.name, async () => {
      const { calls, outcome } = await runAction(actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});

// ---------------------------------------------------------------------------
// C2 de la 11.3a (hallazgo 2 y redondeo): el pago como lo guardan las columnas
// ---------------------------------------------------------------------------

// El saldo se restaba con number sobre el monto sin redondear: un pago de 0.125 sobre 10.00
// dejaba un saldo de 9.88 y la columna guardaba el pago como 0.13 (pago y saldo sumaban
// 10.01). Un pago de 0.004 se guardaba como 0.00. Lo que importa es el valor que guardan las
// columnas numeric(12, 2), no el tipo de JavaScript.
describe("C2 de la 11.3a: el pago redondeado como las columnas", () => {
  const stored = (value: unknown) => new Prisma.Decimal(String(value)).toFixed(2);
  const ten = { "proforma.findUnique": quoteRow({ saldo: D("10.00") }) };

  function dataOf(calls: Awaited<ReturnType<typeof runAction>>["calls"], name: string) {
    const call = calls.find((item) => "prisma" in item && item.prisma === name);

    return (call as { args: { data: Record<string, unknown> } } | undefined)?.args.data;
  }

  it("un pago de 0.125 sobre 10.00: pago y saldo suman el saldo anterior con lo que guardan las columnas", async () => {
    const { calls } = await runAction({ name: "0.125", form: form({ monto_pagado: "0.125" }), data: ten });

    const pago = dataOf(calls, "pago_cliente.create");

    expect([stored(pago?.monto_pagado), stored(pago?.saldo_actual)]).toEqual(["0.13", "9.87"]);
    expect(stored(dataOf(calls, "proforma.update")?.saldo)).toBe("9.87");
  });

  it("un pago de 10.005 sobre 10.00 se rechaza: la columna lo guardaria como 10.01", async () => {
    const { outcome } = await runAction({ name: "10.005", form: form({ monto_pagado: "10.005" }), data: ten });

    expect(outcome).toBe("error: El pago no puede ser mayor que el saldo pendiente: S/ 10.00.");
  });

  it("un pago que se guardaria como 0.00 se rechaza sin abrir la transaccion", async () => {
    const { calls, outcome } = await runAction({ name: "0.004", form: form({ monto_pagado: "0.004" }), data: ten });

    expect(outcome).toBe("error: El monto pagado debe ser mayor que cero.");
    expect(calls.some((call) => "effect" in call && call.effect === "prisma.$transaction")).toBe(false);
  });
});
