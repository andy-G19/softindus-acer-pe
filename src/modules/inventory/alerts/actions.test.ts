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

// La alerta como la ve la base: updateMany con estado_alerta "activa" en el
// where solo cambia una fila si la alerta existe y sigue activa.
function alert(estado_alerta: "activa" | "atendida" | null): DataOverrides {
  return {
    "alerta_stock.updateMany": { count: estado_alerta === "activa" ? 1 : 0 },
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
    name: "una alerta ya atendida no se reescribe: vuelve a la lista sin aviso",
    form: { id_alerta: ALERTA },
    data: alert("atendida"),
  },
  { name: "sin id lanza un error sin tocar Prisma", form: {} },
  { name: "la alerta no existe: lanza un error", form: { id_alerta: ALERTA }, data: alert(null) },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", form: { id_alerta: ALERTA }, role: "WORKSHOP_MASTER" },
  { name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma", form: { id_alerta: ALERTA }, role: "SELLER" },
];

// Atender fija «atendida» solo si la alerta sigue activa, comparando y
// escribiendo en una sola sentencia (updateMany con estado_alerta "activa" en
// el where): un doble clic o una lista desactualizada no cambian quien la
// atendio ni cuando (entrega 10.3).
describe("attendStockAlertAction solo atiende una alerta activa", () => {
  function writesOf(calls: unknown[]) {
    return (calls as Array<{ prisma?: string; args?: { data?: Record<string, unknown> } }>).filter(
      (call) => call.prisma === "alerta_stock.update" || call.prisma === "alerta_stock.updateMany",
    );
  }

  it("compara y fija el estado en una sola escritura", async () => {
    const { calls, outcome } = await runAction({ name: "", form: { id_alerta: ALERTA }, data: alert("activa") });

    expect(writesOf(calls)).toEqual([
      expect.objectContaining({
        prisma: "alerta_stock.updateMany",
        args: {
          where: { id_alerta: ALERTA, estado_alerta: "activa" },
          data: expect.objectContaining({ estado_alerta: "atendida", id_usuario_atencion: "USU00000001" }),
        },
      }),
    ]);
    expect(String(outcome)).toContain("toast=stock-alert-attended");
  });

  it("una alerta ya atendida no cambia quien la atendio ni cuando, y no da el aviso", async () => {
    const { calls, outcome } = await runAction({ name: "", form: { id_alerta: ALERTA }, data: alert("atendida") });

    expect(writesOf(calls).filter((call) => call.prisma === "alerta_stock.update")).toEqual([]);
    expect(String(outcome)).not.toContain("toast=");
  });

  it("una alerta que no existe sigue respondiendo con su error", async () => {
    const { outcome } = await runAction({ name: "", form: { id_alerta: ALERTA }, data: alert(null) });

    expect(outcome).toBe("error: La alerta seleccionada no existe.");
  });
});

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
