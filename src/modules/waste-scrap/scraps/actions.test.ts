import { describe, expect, it, vi } from "vitest";

import { createScrapAction } from "@/modules/waste-scrap/scraps/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion del alta de chatarra (entrega 10.7a), escrita antes de llevarla
// al bloqueo de fila, al resultado de accion y al panel lateral. Fija en un
// snapshot, en orden: la autorizacion, las lecturas, la transaccion, el
// correlativo, la bitacora, las revalidaciones y la redireccion o el error.

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
    getNextCorrelativeId: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string },
    ) => {
      recordEffect("getNextCorrelativeId", params);
      const next = (mocks.correlatives.get(params.prefijo) ?? 11) + 1;
      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

// null deja el campo fuera del formulario: formData.get devuelve null.
type FormFields = Record<string, string | null>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) {
      formData.append(key, value);
    }
  }

  return formData;
}

const form: FormFields = {
  id_material: "MAT00000002",
  id_orden_trabajo: "OTR00000003",
  tipo_material: "Acero",
  peso_kg: "12.5",
  cantidad: "3",
  observaciones: "Corte de planchas",
};

const material = (estado: boolean | null): DataOverrides => ({
  "material.findUnique": estado === null ? null : { id_material: "MAT00000002", estado },
});

const workOrder = (estado: string | null): DataOverrides => ({
  "orden_trabajo.findUnique": estado === null ? null : { id_orden_trabajo: "OTR00000003", estado },
});

const scrapWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, ...fields },
  data: { ...material(true), ...workOrder("en_proceso"), ...data },
});

const CASES: ActionCase[] = [
  { name: "ADMIN registra la chatarra acumulada con la bitacora en la transaccion", ...scrapWith() },
  { name: "WORKSHOP_MASTER tambien registra chatarra", ...scrapWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede registrar", ...scrapWith(), role: "SELLER" },
  { name: "sin material ni orden no se leen", ...scrapWith({ id_material: "", id_orden_trabajo: "" }) },
  { name: "solo con peso", ...scrapWith({ cantidad: "" }) },
  { name: "solo con cantidad", ...scrapWith({ peso_kg: "" }) },
  { name: "sin peso ni cantidad se rechaza", ...scrapWith({ peso_kg: "", cantidad: "" }) },
  { name: "las observaciones vacias se guardan como null", ...scrapWith({ observaciones: "" }) },
  { name: "el tipo es obligatorio", ...scrapWith({ tipo_material: "" }) },
  { name: "el tipo no supera 50 caracteres", ...scrapWith({ tipo_material: "x".repeat(51) }) },
  { name: "el peso negativo se rechaza", ...scrapWith({ peso_kg: "-1" }) },
  { name: "el peso no numerico se rechaza", ...scrapWith({ peso_kg: "abc" }) },
  { name: "un peso de 0.001 pasa sin redondear", ...scrapWith({ peso_kg: "0.001", cantidad: "" }) },
  { name: "el material no existe", ...scrapWith({}, material(null)) },
  { name: "el material esta inactivo", ...scrapWith({}, material(false)) },
  { name: "la orden no existe", ...scrapWith({}, workOrder(null)) },
  { name: "la orden esta anulada", ...scrapWith({}, workOrder("anulada")) },
  { name: "una orden finalizada se admite", ...scrapWith({}, workOrder("finalizada")) },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
];

describe("createScrapAction", () => {
  for (const { name, form: fields, data, role } of CASES) {
    it(name, async () => {
      mocks.correlatives.clear();

      const { calls, result } = await characterizeHandler(
        async () => {
          try {
            return { estado: await createScrapAction(formOf(fields)) };
          } catch (error) {
            return (
              describeNavigationError(error) ??
              `error: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        },
        data,
        { role },
      );

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(result).toMatchSnapshot("resultado");
    });
  }
});
