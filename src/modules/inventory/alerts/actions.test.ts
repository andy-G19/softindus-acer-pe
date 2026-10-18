import { describe, expect, it, vi } from "vitest";

import { attendStockAlertAction } from "@/modules/inventory/alerts/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de «Marcar atendida» en las alertas de stock (entrega 10.3),
// escrita antes de llevarla al resultado de accion. Fija la autorizacion, la
// lectura, la escritura (con el cliente global, sin transaccion), las
// revalidaciones y el resultado: la redireccion o el error que lanza. Hoy no
// comprueba si la alerta ya estaba atendida ni registra bitacora; un error
// lanzado se ve en produccion como la pagina de error generica.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock({
    transactions: true,
    recordTransactionEnd: true,
    writesOutsideTransaction: true,
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

type ActionCase = { name: string; form: Record<string, string>; data?: DataOverrides; role?: Role };

function formOf(fields: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  return formData;
}

async function runAction(actionCase: ActionCase) {
  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        return { estado: await attendStockAlertAction(formOf(actionCase.form)) };
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    actionCase.data,
    { role: actionCase.role },
  );

  return { calls, outcome: result };
}

const ALERTA = "ALE00000003";

function alert(estado_alerta: "activa" | "atendida" | null): DataOverrides {
  return {
    "alerta_stock.findUnique":
      estado_alerta === null
        ? null
        : {
            id_alerta: ALERTA,
            id_material: "MAT00000004",
            estado_alerta,
            fecha_atencion: estado_alerta === "atendida" ? new Date("2026-07-10T14:00:00.000Z") : null,
            id_usuario_atencion: estado_alerta === "atendida" ? "USU00000002" : null,
          },
  };
}

const CASES: ActionCase[] = [
  { name: "ADMIN atiende una alerta activa", form: { id_alerta: ALERTA }, data: alert("activa") },
  {
    name: "una alerta ya atendida se vuelve a atender: cambia quien y cuando",
    form: { id_alerta: ALERTA },
    data: alert("atendida"),
  },
  { name: "sin id lanza un error sin tocar Prisma", form: {} },
  { name: "la alerta no existe: lanza un error", form: { id_alerta: ALERTA }, data: alert(null) },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", form: { id_alerta: ALERTA }, role: "WORKSHOP_MASTER" },
  { name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma", form: { id_alerta: ALERTA }, role: "SELLER" },
];

describe("attendStockAlertAction", () => {
  for (const actionCase of CASES) {
    it(actionCase.name, async () => {
      const { calls, outcome } = await runAction(actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});
