import { describe, expect, it, vi } from "vitest";

import {
  createFailureAction,
  updateFailureStatusAction,
} from "@/modules/maintenance/failures/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de fallas (entrega 10.5b), escrita antes de
// corregir sus esquemas y sus decisiones fuera de la transaccion y de llevarlas
// al resultado de accion y al panel lateral. Cada caso ejecuta la accion real
// con Prisma, la sesion, la cache, la bitacora y los correlativos simulados, y
// fija en un snapshot, en orden: la autorizacion con sus roles, las lecturas,
// la transaccion con sus escrituras y su final, los correlativos, la bitacora,
// las revalidaciones y el resultado: la redireccion o el error que lanza, con
// su mensaje exacto.
//
// Hoy las dos acciones reciben solo el FormData, autorizan con requireRole
// (ADMIN y maestro de taller), leen la maquina o la falla y deciden fuera de
// la transaccion (hallazgo 2 de la auditoria de la 10.5), lanzan un Error con
// los mensajes de Zod unidos y redirigen con su toast al terminar.

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

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

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

async function runCase(run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">) {
  mocks.correlatives.clear();

  return characterizeHandler(
    async () => {
      try {
        return { estado: await run(formOf(actionCase.form)) };
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
}

function defineCases(name: string, run: (formData: FormData) => Promise<unknown>, cases: ActionCase[]) {
  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        const { calls, result } = await runCase(run, actionCase);

        expectAuthorizesBeforePrisma(calls);
        expect(calls).toMatchSnapshot("llamadas");
        expect(result).toMatchSnapshot("resultado");
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const MAQUINA = "MAQ00000003";
const FALLA = "FAL00000005";

const createForm: FormFields = {
  id_maquina: MAQUINA,
  fecha_falla: "2026-07-14T09:30",
  descripcion: "El husillo vibra al pasar de 800 rpm",
  responsable_registro: "Juan Quispe",
  estado_atencion: "pendiente",
  tiempo_perdido_horas: "2.5",
  impacto_produccion: "Se detuvo el torneado de bridas",
};

const emptyOptionals: FormFields = {
  responsable_registro: "",
  tiempo_perdido_horas: "",
  impacto_produccion: "",
};

const machine = (estado: string | null): DataOverrides => ({
  "maquina.findUnique": estado === null ? null : { id_maquina: MAQUINA, estado },
});

const failure = (estado_atencion: string | null): DataOverrides => ({
  "falla_maquina.findUnique": estado_atencion === null ? null : { id_falla: FALLA, estado_atencion },
});

const createWith = (fields: FormFields, data: DataOverrides = machine("operativa")) => ({
  form: { ...createForm, ...fields },
  data,
});

const statusWith = (estado_atencion: string, current: string | null = "pendiente") => ({
  form: { id_falla: FALLA, estado_atencion },
  data: failure(current),
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createFailureAction", createFailureAction, [
  { name: "ADMIN registra la falla con su correlativo y la bitacora dentro de la transaccion", ...createWith({}) },
  {
    name: "WORKSHOP_MASTER tambien registra fallas",
    ...createWith({ estado_atencion: "en_atencion" }),
    role: "WORKSHOP_MASTER",
  },
  { name: "SELLER: sin permiso, sin tocar Prisma", ...createWith({}), role: "SELLER" },
  { name: "los opcionales vacios se guardan como null", ...createWith(emptyOptionals) },
  {
    name: "los opcionales ausentes del formulario cuentan como vacios",
    ...createWith({ responsable_registro: null, tiempo_perdido_horas: null, impacto_produccion: null }),
  },
  {
    name: "datos invalidos lanzan los mensajes unidos sin tocar Prisma",
    ...createWith({ id_maquina: "MAQ1", descripcion: "mal", estado_atencion: "rota", tiempo_perdido_horas: "-1" }),
  },
  {
    name: "un POST sin campos lanza los mensajes de Zod sin tocar Prisma",
    form: {},
  },
  { name: "un tiempo perdido que no es numero lanza su mensaje", ...createWith({ tiempo_perdido_horas: "dos" }) },
  {
    name: "un tiempo perdido de 1e12 pasa el esquema y llega a la base",
    ...createWith({ tiempo_perdido_horas: "1e12" }),
  },
  { name: "una fecha que no es fecha lanza su mensaje", ...createWith({ fecha_falla: "mañana" }) },
  {
    name: "el 30 de febrero pasa el esquema y se guarda como el 2 de marzo",
    ...createWith({ fecha_falla: "2026-02-30T10:00" }),
  },
  { name: "la maquina no existe", ...createWith({}, machine(null)) },
  { name: "no registra fallas sobre una maquina inactiva", ...createWith({}, machine("inactiva")) },
  { name: "no registra fallas sobre una maquina dada de baja", ...createWith({}, machine("dada_de_baja")) },
  { name: "una maquina en reparacion admite otra falla", ...createWith({}, machine("en_reparacion")) },
]);

defineCases("updateFailureStatusAction", updateFailureStatusAction, [
  { name: "de pendiente a en atencion", ...statusWith("en_atencion") },
  { name: "de pendiente a reparada, sin reparacion", ...statusWith("reparada") },
  { name: "de pendiente a anulada", ...statusWith("anulada") },
  { name: "pedir el estado que ya tiene vuelve a escribirlo", ...statusWith("pendiente") },
  { name: "de en atencion a pendiente", ...statusWith("pendiente", "en_atencion") },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...statusWith("en_atencion"), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso, sin tocar Prisma", ...statusWith("en_atencion"), role: "SELLER" },
  { name: "una falla reparada no se modifica", ...statusWith("pendiente", "reparada") },
  { name: "una falla anulada no se modifica", ...statusWith("pendiente", "anulada") },
  { name: "la falla no existe", ...statusWith("en_atencion", null) },
  { name: "un estado que no existe lanza su mensaje sin tocar Prisma", ...statusWith("cerrada") },
  { name: "un POST sin campos lanza los mensajes de Zod sin tocar Prisma", form: {} },
]);

// Lo que la accion escribe, fuera del snapshot: el estado pedido y la fecha
// tal como la deja el esquema.
describe("createFailureAction escribe lo que recibe", () => {
  type Recorded = { prisma?: string; args?: { data?: Record<string, unknown> } };

  async function created(fields: FormFields) {
    const { calls } = await runCase(createFailureAction, createWith(fields));
    const write = (calls as Recorded[]).find((call) => call.prisma === "falla_maquina.create");

    return write?.args?.data;
  }

  it("la fecha y hora del formulario se leen en la zona del servidor", async () => {
    expect((await created({}))?.fecha_falla).toEqual(new Date("2026-07-14T09:30:00.000Z"));
  });

  it("hoy el 30 de febrero se convierte en el 2 de marzo", async () => {
    expect((await created({ fecha_falla: "2026-02-30T10:00" }))?.fecha_falla).toEqual(
      new Date("2026-03-02T10:00:00.000Z"),
    );
  });
});
