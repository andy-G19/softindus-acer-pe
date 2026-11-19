import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createPettyCashBoxAction } from "@/modules/petty-cash/boxes/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion de abrir una caja chica (C1 de la 11.4a), escrita antes de tocar la accion:
// hasta aqui no tenia ninguna prueba.
//
// Fija la busqueda del nombre repetido sin distinguir mayusculas (hoy fuera de la transaccion),
// el correlativo, la caja abierta con el saldo actual igual al inicial, las revalidaciones y el
// resultado. Abrir caja no escribe bitacora.
//
// C7 de la 11.4a (D46): la accion devuelve un resultado en lugar de redirigir o lanzar, y busca el
// nombre repetido dentro de la transaccion que crea la caja. Los casos de C1 quedan con el mismo
// nombre; su resultado es ahora el estado del formulario.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
// Cada respuesta lleva un operationId aleatorio: se fija para que el snapshot sea estable.
vi.mock("@/lib/action-result", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/action-result")>()),
  newOperationId: () => "operacion-de-prueba",
}));
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

/** Un caso sin formulario usa el formulario valido de su archivo. */
type CaseInput = Omit<ActionCase, "form"> & { form?: ActionCase["form"] };

async function runAction(actionCase: ActionCase) {
  mocks.correlatives.clear();

  const formData = new FormData();

  for (const [key, value] of Object.entries(actionCase.form)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        return await createPettyCashBoxAction({ status: "idle" }, formData);
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

const DEFAULT_DATA: DataOverrides = {
  "caja_chica.findFirst": null,
};

const form = (changes: Record<string, string> = {}) => ({
  nombre_caja: "  Caja almacen  ",
  saldo_inicial: "250.40",
  fecha_apertura: "2026-11-10",
  responsable: "",
  observaciones: "",
  ...changes,
});

const caseInputs: CaseInput[] = [
  { name: "caja valida: la abre con su saldo inicial como saldo actual" },
  {
    name: "saldo inicial cero, con responsable y observaciones",
    form: form({ saldo_inicial: "0", responsable: " Rosa ", observaciones: " turno tarde " }),
  },
  {
    name: "nombre repetido",
    data: { "caja_chica.findFirst": { id_caja_chica: "CAJ00000001", nombre_caja: "caja almacen", saldo_actual: D("1.00") } },
  },
  { name: "saldo inicial negativo", form: form({ saldo_inicial: "-1" }) },
  { name: "nombre corto y sin fecha", form: form({ nombre_caja: "ab", fecha_apertura: "" }) },
  { name: "sin permiso: el vendedor", role: "SELLER" },
];

const cases: ActionCase[] = caseInputs.map((actionCase) => ({
  form: form(),
  ...actionCase,
}));

describe("createPettyCashBoxAction", () => {
  for (const actionCase of cases) {
    it(actionCase.name, async () => {
      const { calls, outcome } = await runAction(actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});

// Grupo de fixes, C1 (D123, hallazgo 7 de la 11.4a): la apertura buscaba el nombre antes de
// reservar el correlativo de caja, sin nada que ordenara dos aperturas simultaneas con el mismo
// nombre: podian pasar las dos. Ahora lo busca despues de la reserva, cuya fila queda bloqueada
// (FOR UPDATE) hasta el final: la segunda apertura espera y ve la primera. Es el patron del alta
// rapida de proveedor (C1 de la 11.7d). La espera en si no se puede probar aqui (ni en PGlite);
// esto fija el orden.
describe("C1 del grupo de fixes: la apertura busca el nombre con el correlativo reservado", () => {
  function indexOf(calls: Awaited<ReturnType<typeof runAction>>["calls"], name: string) {
    return calls.findIndex((call) => JSON.stringify(call).includes(name));
  }

  it("con un nombre nuevo, la busqueda va dentro de la transaccion y despues del correlativo", async () => {
    const { calls } = await runAction({ name: "orden", form: form() });

    const transaccion = indexOf(calls, "prisma.$transaction");
    const correlativo = indexOf(calls, "getNextCorrelativeId");
    const busqueda = indexOf(calls, "caja_chica.findFirst");

    expect(transaccion).toBeGreaterThanOrEqual(0);
    expect(correlativo, "el correlativo se reserva dentro de la transaccion").toBeGreaterThan(transaccion);
    expect(busqueda, "la busqueda del nombre va despues de reservar el correlativo").toBeGreaterThan(correlativo);
    expect(indexOf(calls, "caja_chica.create")).toBeGreaterThan(busqueda);
  });

  it("con un nombre repetido, revierte la transaccion y responde en el campo del nombre", async () => {
    const { calls, outcome } = await runAction({
      name: "repetido",
      form: form(),
      data: { "caja_chica.findFirst": { id_caja_chica: "CAJ00000001" } },
    });

    expect(indexOf(calls, "getNextCorrelativeId")).toBeGreaterThanOrEqual(0);
    expect(indexOf(calls, "caja_chica.create")).toBe(-1);
    expect(indexOf(calls, "prisma.$transaction:rollback"), "la transaccion se revierte").toBeGreaterThanOrEqual(0);
    expect(outcome).toMatchObject({
      status: "error",
      fieldErrors: { nombre_caja: ["Ya existe una caja chica con ese nombre."] },
    });
  });
});
