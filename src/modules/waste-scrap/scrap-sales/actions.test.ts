import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createScrapSaleAction } from "@/modules/waste-scrap/scrap-sales/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isPrismaCall,
  isRowLock,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion de la venta de chatarra (C1 de la 11.4b), escrita antes de tocar la accion:
// hasta aqui no tenia ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion, las lecturas de la
// chatarra (con sus ventas) y de la caja (hoy fuera de la transaccion y sin bloquear ninguna), los
// correlativos, el movimiento de caja y el aumento del saldo cuando hay caja, la venta, la chatarra
// vendida, las dos bitacoras, el final de la transaccion, las revalidaciones y el resultado: la
// redireccion o el error exacto. El peso o la cantidad que el formulario deja vacios toman los de
// la chatarra.

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

type ActionCase = {
  name: string;
  form: Record<string, string>;
  data?: DataOverrides;
  role?: "ADMIN" | "SELLER" | "WORKSHOP_MASTER";
};

/** Un caso sin formulario usa el formulario valido de este archivo. */
type CaseInput = Omit<ActionCase, "form"> & { form?: ActionCase["form"] };

/** Chatarra acumulada de 15.00 kg y 3 unidades, sin ventas. */
function scrapRow(changes: Record<string, unknown> = {}) {
  return {
    id_chatarra: "CHA00000004",
    tipo_material: "Retazos de plancha",
    peso_kg: D("15.00"),
    cantidad: D("3.00"),
    estado: "acumulada",
    venta_chatarra: [],
    ...changes,
  };
}

/** Caja abierta. */
function boxRow(changes: Record<string, unknown> = {}) {
  return {
    id_caja_chica: "CAJ00000002",
    estado: "abierta",
    ...changes,
  };
}

const DEFAULT_DATA: DataOverrides = {
  "chatarra.findUnique": scrapRow(),
  "caja_chica.findUnique": boxRow(),
};

const form = (changes: Record<string, string> = {}) => ({
  id_chatarra: "CHA00000004",
  id_caja_chica: "CAJ00000002",
  fecha_venta: "2026-11-10",
  cantidad_vendida: "",
  peso_vendido_kg: "12.50",
  monto_recibido: "80.25",
  destino_dinero: "",
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
        await createScrapSaleAction(formData);

        return "termino sin redirigir";
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { ...DEFAULT_DATA, ...actionCase.data },
    { role: actionCase.role ?? "ADMIN" },
  );

  return { calls, outcome: result };
}

const caseInputs: CaseInput[] = [
  { name: "venta con caja: movimiento de ingreso, saldo, venta y chatarra vendida" },
  {
    name: "venta sin caja: solo la venta y la chatarra vendida",
    form: form({ id_caja_chica: "", destino_dinero: " Compra de discos ", observaciones: " reciclador " }),
  },
  {
    name: "peso y cantidad vacios: toma los de la chatarra",
    form: form({ peso_vendido_kg: "", cantidad_vendida: "" }),
  },
  {
    name: "chatarra sin peso ni cantidad y formulario vacio",
    form: form({ peso_vendido_kg: "", cantidad_vendida: "" }),
    data: { "chatarra.findUnique": scrapRow({ peso_kg: null, cantidad: null }) },
  },
  { name: "la chatarra no existe", data: { "chatarra.findUnique": null } },
  { name: "la chatarra ya esta vendida", data: { "chatarra.findUnique": scrapRow({ estado: "vendida" }) } },
  {
    name: "la chatarra ya tiene una venta",
    data: { "chatarra.findUnique": scrapRow({ venta_chatarra: [{ id_venta_chatarra: "VCH00000001" }] }) },
  },
  { name: "el peso vendido supera el registrado", form: form({ peso_vendido_kg: "15.01" }) },
  { name: "la cantidad vendida supera la registrada", form: form({ cantidad_vendida: "3.5" }) },
  { name: "la caja no existe", data: { "caja_chica.findUnique": null } },
  { name: "caja cerrada", data: { "caja_chica.findUnique": boxRow({ estado: "cerrada" }) } },
  { name: "monto cero", form: form({ monto_recibido: "0" }) },
  { name: "sin chatarra ni fecha", form: form({ id_chatarra: "", fecha_venta: "" }) },
  { name: "sin permiso: el maestro de taller", role: "WORKSHOP_MASTER" },
];

const cases: ActionCase[] = caseInputs.map((actionCase) => ({
  form: form(),
  ...actionCase,
}));

describe("createScrapSaleAction", () => {
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
// C3 de la 11.4b (D48): la venta decide con la chatarra y la caja bloqueadas
// ---------------------------------------------------------------------------

// Dos envios simultaneos leian la chatarra fuera de la transaccion, los dos la veian sin vender y
// los dos la vendian: dos ventas y dos ingresos en la caja. Ahora la venta bloquea la chatarra
// antes de leerla y despues su caja antes de leer su estado, la chatarra primero y la caja al
// final (D44 de la 11.4a). PGlite no prueba la espera: aqui se fija el orden.
describe("C3 de la 11.4b: la venta bloquea la chatarra y despues la caja", () => {
  it.each([
    ["una venta con caja", {}],
    ["una venta con el peso por encima del registrado", { peso_vendido_kg: "15.01" }],
  ])("%s bloquea la chatarra antes de leerla", async (_name, changes) => {
    const { calls } = await runAction({ name: "C3", form: form(changes) });

    expectRowLockedBefore(calls, {
      table: "chatarra",
      id: "CHA00000004",
      reads: (call) => call.prisma === "chatarra.findUnique",
    });
  });

  it("bloquea la caja antes de leerla, despues de la chatarra", async () => {
    const { calls } = await runAction({ name: "C3", form: form() });

    expectRowLockedBefore(calls, {
      table: "caja_chica",
      id: "CAJ00000002",
      reads: (call) => call.prisma === "caja_chica.findUnique",
    });
    expect(
      calls.findIndex((call) => isRowLock(call, "chatarra", "CHA00000004")),
      "la chatarra se bloquea antes que la caja",
    ).toBeLessThan(calls.findIndex((call) => isRowLock(call, "caja_chica", "CAJ00000002")));
  });

  it("una venta sin caja no bloquea ninguna caja", async () => {
    const { calls } = await runAction({ name: "C3", form: form({ id_caja_chica: "" }) });

    expectRowLockedBefore(calls, {
      table: "chatarra",
      id: "CHA00000004",
      reads: (call) => call.prisma === "chatarra.findUnique",
    });
    // Ningun SELECT ... FROM aceros.caja_chica: sin caja no hay fila que bloquear.
    const boxLocks = calls.filter(
      (call) => isPrismaCall(call) && call.prisma === "$queryRaw" && String((call.args as { sql: string }).sql).includes("aceros.caja_chica"),
    );

    expect(boxLocks).toEqual([]);
  });
});
