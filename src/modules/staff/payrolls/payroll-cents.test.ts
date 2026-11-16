import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { generatePayrollAction } from "@/modules/staff/payrolls/actions";
import {
  characterizeHandler,
  describeNavigationError,
  isPrismaCall,
  type DataOverrides,
} from "@/testing/page-characterization";

// C2 de la 11.5 (D53): bruto, descuento y neto se redondeaban por separado con toFixed. Con un
// descuento de 10.005 sobre 100.00 se guardaba 10.01 de descuento y 90.00 de neto: la planilla no
// cuadraba (hallazgo 1). Ahora el descuento se redondea como su columna, en centesimos sobre el
// decimal escrito, y el neto es el bruto menos ese descuento redondeado.

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

/** Dos asistencias validas con una tarifa de 50.00: bruto 100.00. */
const DATA: DataOverrides = {
  "operario.findFirst": {
    id_operario: "OPE00000003",
    nombres: "Luis",
    apellidos: "Quispe",
    modalidad_pago: "semanal",
    tarifa: D("50.00"),
  },
  "planilla_pago.findFirst": null,
  "asistencia.findMany": [
    { id_asistencia: "ASI00000011", falta: false, tardanza: false, horas_trabajadas: D("8.00") },
    { id_asistencia: "ASI00000012", falta: false, tardanza: false, horas_trabajadas: D("8.00") },
  ],
};

/** Los montos que la accion manda a la planilla con ese descuento. */
async function savedAmounts(descuentos: string) {
  vi.spyOn(console, "log").mockImplementation(() => {});

  const formData = new FormData();

  for (const [key, value] of Object.entries({
    clave_operacion: "5b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
    id_operario: "OPE00000003",
    periodo_inicio: "2026-11-02",
    periodo_fin: "2026-11-08",
    descuentos,
  })) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(async () => {
    try {
      // Desde C6 de la 11.5 generar devuelve su resultado en lugar de redirigir.
      const state = await generatePayrollAction({ status: "idle" }, formData);

      return state.status === "success" ? "guardado" : state.status === "error" ? `error: ${state.error}` : "sin respuesta";
    } catch (error) {
      return describeNavigationError(error) ?? `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }, DATA);

  expect(result).toBe("guardado");

  const create = calls.filter(isPrismaCall).find((call) => call.prisma === "planilla_pago.create");
  const data = (create?.args as { data: Record<string, unknown> } | undefined)?.data ?? {};

  return { bruto: data.monto_bruto, descuento: data.descuentos, neto: data.monto_neto };
}

describe("C2 de la 11.5: la planilla en centesimos", () => {
  it.each([
    ["10.005", "10.01", "89.99"],
    ["0.125", "0.13", "99.87"],
    // (1.005).toFixed(2) da 1.00; la columna numeric guarda 1.01.
    ["1.005", "1.01", "98.99"],
  ])("un descuento de %s se guarda como %s y el neto es %s", async (descuento, guardado, neto) => {
    expect(await savedAmounts(descuento)).toEqual({ bruto: "100.00", descuento: guardado, neto });
  });

  it("sin descuento, el neto es el bruto", async () => {
    expect(await savedAmounts("")).toEqual({ bruto: "100.00", descuento: "0.00", neto: "100.00" });
  });
});
