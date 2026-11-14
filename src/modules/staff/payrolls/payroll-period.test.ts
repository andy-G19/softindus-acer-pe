import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { generatePayrollAction } from "@/modules/staff/payrolls/actions";
import {
  characterizeHandler,
  describeNavigationError,
  isPrismaCall,
  type DataOverrides,
  type PrismaArgs,
} from "@/testing/page-characterization";

// C5 de la 11.5 (D55 y D56). Solo se rechazaba el mismo periodo exacto: del 1 al 7 y del 3 al 9
// del mismo operario pasaban, y las asistencias del 3 al 7 se pagaban dos veces (hallazgo 5).
// Ahora se rechaza un periodo que se cruce con otra planilla no anulada del mismo operario,
// nombrandola. Un descuento que deja el neto en 0.00 tambien se rechaza: esa planilla no se
// podia pagar (hallazgo 6).
//
// El doble de Prisma no evalua el where: aqui se fija la consulta y que un cruce encontrado
// rechaza sin escribir; los cruces de verdad se prueban en Postgres (payroll.integration.test.ts).

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
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ registerAuditLog: async () => {} }));
vi.mock("@/lib/correlatives-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
  getNextCorrelativeId: async () => "PLA00000021",
}));

const D = (value: string) => new Prisma.Decimal(value);

/** La consulta del periodo exacto compara fechas; la del cruce, rangos. */
const isOverlapQuery = (args: PrismaArgs) =>
  typeof (args?.where as { periodo_inicio?: unknown } | undefined)?.periodo_inicio === "object" &&
  !((args?.where as { periodo_inicio?: unknown }).periodo_inicio instanceof Date);

function data(overlap: unknown): DataOverrides {
  return {
    "operario.findFirst": {
      id_operario: "OPE00000003",
      nombres: "Luis",
      apellidos: "Quispe",
      modalidad_pago: "semanal",
      tarifa: D("50.00"),
    },
    "planilla_pago.findFirst": (args: PrismaArgs) => (isOverlapQuery(args) ? overlap : null),
    "asistencia.findMany": [
      { id_asistencia: "ASI00000011", falta: false, tardanza: false, horas_trabajadas: D("8.00") },
      { id_asistencia: "ASI00000012", falta: false, tardanza: false, horas_trabajadas: D("8.00") },
    ],
  };
}

async function generate(overlap: unknown, descuentos = "") {
  vi.spyOn(console, "log").mockImplementation(() => {});

  const formData = new FormData();

  for (const [key, value] of Object.entries({
    id_operario: "OPE00000003",
    periodo_inicio: "2026-11-05",
    periodo_fin: "2026-11-11",
    descuentos,
  })) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(async () => {
    try {
      await generatePayrollAction(formData);

      return "guardado";
    } catch (error) {
      return describeNavigationError(error)?.startsWith("redirect:")
        ? "guardado"
        : `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }, data(overlap));

  const prismaCalls = calls.filter(isPrismaCall);

  return {
    result,
    overlapQuery: prismaCalls.find((call) => call.prisma === "planilla_pago.findFirst" && isOverlapQuery(call.args as PrismaArgs))
      ?.args as { where: Record<string, unknown> } | undefined,
    created: prismaCalls.some((call) => call.prisma === "planilla_pago.create"),
    rolledBack: calls.some((call) => "effect" in call && call.effect === "prisma.$transaction:rollback"),
  };
}

describe("C5 de la 11.5: periodos que se cruzan", () => {
  it("busca otra planilla no anulada del operario que empiece antes del fin y termine despues del inicio", async () => {
    const { overlapQuery } = await generate(null);

    expect(overlapQuery?.where).toEqual({
      id_operario: "OPE00000003",
      estado_pago: { not: "anulada" },
      periodo_inicio: { lte: new Date("2026-11-11T00:00:00.000Z") },
      periodo_fin: { gte: new Date("2026-11-05T00:00:00.000Z") },
    });
  });

  it("un cruce encontrado rechaza nombrando la planilla, sin escribir", async () => {
    const outcome = await generate({
      id_planilla: "PLA00000007",
      periodo_inicio: new Date("2026-11-02T00:00:00.000Z"),
      periodo_fin: new Date("2026-11-08T00:00:00.000Z"),
    });

    expect(outcome).toMatchObject({
      result:
        "error: Este operario ya tiene la planilla PLA00000007, del 02/11/2026 al 08/11/2026, que se cruza con el periodo seleccionado.",
      created: false,
      rolledBack: true,
    });
  });

  it("sin cruces, genera", async () => {
    expect(await generate(null)).toMatchObject({ result: "guardado", created: true });
  });
});

describe("C5 de la 11.5: un neto de 0.00 no es una planilla", () => {
  it.each(["100", "100.004"])("un descuento de %s sobre 100.00 se rechaza sin escribir", async (descuentos) => {
    expect(await generate(null, descuentos)).toMatchObject({
      result: "error: Los descuentos no pueden igualar o superar el monto bruto calculado.",
      created: false,
      rolledBack: true,
    });
  });

  it("un descuento que deja un centimo genera", async () => {
    expect(await generate(null, "99.99")).toMatchObject({ result: "guardado", created: true });
  });
});
