import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createRepairAction,
  updateRepairStatusAction,
} from "@/modules/maintenance/repairs/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de reparaciones (entrega 10.5b), escrita
// antes de corregir sus importes, sus esquemas y sus decisiones fuera de la
// transaccion y de llevarlas a una superficie amplia con lineas dinamicas.
// Cada caso fija en un snapshot, en orden: la autorizacion con sus roles, las
// lecturas, la transaccion con sus escrituras y su final, los correlativos,
// la bitacora, las revalidaciones y el resultado: la redireccion o el error
// que lanza, con su mensaje exacto.
//
// Hoy las dos acciones reciben solo el FormData y autorizan solo a ADMIN con
// requireRole. El alta lee tres ranuras fijas de repuesto (id_repuesto_N y
// cantidad_N), ignora en silencio la que llega incompleta (hallazgo 7),
// calcula subtotales y total en coma flotante sin redondear (hallazgo 3) y
// decide sobre la falla fuera de la transaccion (hallazgo 2). El cambio de
// estado lee la reparacion fuera de la transaccion y comprueba dentro, con el
// dato viejo, si esta finalizada. Las reglas de negocio que el hallazgo 12
// registra (anular devuelve la falla a pendiente y deja la maquina en
// reparacion; ejecutar cierra la falla aunque otra reparacion siga
// programada) se fijan tal como estan.

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

  function reserve(prefijo: string, cantidad: number) {
    const last = mocks.correlatives.get(prefijo) ?? 20;
    mocks.correlatives.set(prefijo, last + cantidad);

    return Array.from({ length: cantidad }, (_, index) => formatCorrelativeId(prefijo, last + index + 1));
  }

  return {
    ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
    getNextCorrelativeId: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string },
    ) => {
      recordEffect("getNextCorrelativeId", params);

      return reserve(params.prefijo, 1)[0];
    },
    getNextCorrelativeIds: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string; cantidad: number },
    ) => {
      recordEffect("getNextCorrelativeIds", params);

      return reserve(params.prefijo, params.cantidad);
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

const FALLA = "FAL00000007";
const MAQUINA = "MAQ00000005";
const REPARACION = "RPA00000003";
const RODAMIENTO = "REP00000001";
const RETEN = "REP00000002";
const CORREA = "REP00000003";

const createForm: FormFields = {
  id_falla: FALLA,
  fecha_reparacion: "2026-07-16",
  tecnico_proveedor: "Servicios Electromecanicos Lima",
  mano_obra: "150.50",
  estado_reparacion: "programada",
  observaciones: "Cambiar rodamientos del cabezal",
  id_repuesto_1: "",
  cantidad_1: "",
  id_repuesto_2: "",
  cantidad_2: "",
  id_repuesto_3: "",
  cantidad_3: "",
};

// Dos repuestos de 1,25 x S/ 10,25 sin mano de obra: el ejemplo del hallazgo
// 3, donde la base redondea cada columna por su cuenta.
const twoSpareParts: FormFields = {
  mano_obra: "",
  id_repuesto_1: RODAMIENTO,
  cantidad_1: "1.25",
  id_repuesto_2: RETEN,
  cantidad_2: "1.25",
};

const SPARE_PARTS = [
  { id_repuesto: RODAMIENTO, nombre: "Rodamiento 6205", costo_unitario: new Prisma.Decimal("10.25"), estado: true },
  { id_repuesto: RETEN, nombre: "Reten 35x52", costo_unitario: new Prisma.Decimal("10.25"), estado: true },
  { id_repuesto: CORREA, nombre: "Correa B-42", costo_unitario: new Prisma.Decimal("38.90"), estado: true },
];

// La falla con su maquina (include) y los repuestos activos que existen: la
// base devuelve los pedidos en el in que existan y esten activos.
function lookups({
  failureState = "pendiente" as string | null,
  available = SPARE_PARTS.map((part) => part.id_repuesto),
} = {}): DataOverrides {
  return {
    "falla_maquina.findUnique":
      failureState === null
        ? null
        : {
            id_falla: FALLA,
            id_maquina: MAQUINA,
            estado_atencion: failureState,
            maquina: { id_maquina: MAQUINA, nombre: "Torno paralelo", estado: "en_reparacion" },
          },
    "repuesto.findMany": (args: PrismaArgs) => {
      const where = args?.where as { id_repuesto: { in: string[] } };

      return SPARE_PARTS.filter(
        (part) => where.id_repuesto.in.includes(part.id_repuesto) && available.includes(part.id_repuesto),
      );
    },
  };
}

const createWith = (fields: FormFields, data: DataOverrides = lookups()) => ({
  form: { ...createForm, ...fields },
  data,
});

const repair = (estado_reparacion: string | null): DataOverrides => ({
  "reparacion.findUnique":
    estado_reparacion === null
      ? null
      : {
          id_reparacion: REPARACION,
          id_falla: FALLA,
          estado_reparacion,
          falla_maquina: { id_falla: FALLA, id_maquina: MAQUINA, estado_atencion: "en_atencion" },
        },
});

const statusWith = (estado_reparacion: string, current: string | null = "programada") => ({
  form: { id_reparacion: REPARACION, estado_reparacion },
  data: repair(current),
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createRepairAction", createRepairAction, [
  {
    name: "programada sin repuestos: crea la reparacion y pasa la falla a en atencion y la maquina a en reparacion",
    ...createWith({}),
  },
  { name: "observada hace lo mismo que programada", ...createWith({ estado_reparacion: "observada" }) },
  {
    name: "ejecutada: la falla queda reparada y la maquina operativa",
    ...createWith({ estado_reparacion: "ejecutada" }),
  },
  { name: "anulada al crear no toca la falla ni la maquina", ...createWith({ estado_reparacion: "anulada" }) },
  {
    name: "dos repuestos: los detalles con sus correlativos y los importes en coma flotante",
    ...createWith(twoSpareParts),
  },
  {
    name: "tres repuestos con mano de obra",
    ...createWith({ id_repuesto_1: RODAMIENTO, cantidad_1: "2", id_repuesto_2: RETEN, cantidad_2: "1", id_repuesto_3: CORREA, cantidad_3: "0.5" }),
  },
  {
    name: "una cantidad de 1,005 se usa sin redondear en el subtotal",
    ...createWith({ id_repuesto_1: RODAMIENTO, cantidad_1: "1.005" }),
  },
  {
    name: "una linea con repuesto y sin cantidad se ignora en silencio",
    ...createWith({ id_repuesto_1: RODAMIENTO, cantidad_1: "", id_repuesto_2: RETEN, cantidad_2: "1" }),
  },
  {
    name: "una linea con cantidad y sin repuesto se ignora en silencio",
    ...createWith({ id_repuesto_1: "", cantidad_1: "3" }),
  },
  {
    name: "el mismo repuesto en dos lineas",
    ...createWith({ id_repuesto_1: RODAMIENTO, cantidad_1: "1", id_repuesto_3: RODAMIENTO, cantidad_3: "2" }),
  },
  {
    name: "un repuesto inexistente o inactivo",
    ...createWith({ id_repuesto_1: RODAMIENTO, cantidad_1: "1", id_repuesto_2: RETEN, cantidad_2: "1" }, lookups({ available: [RODAMIENTO] })),
  },
  { name: "un id de repuesto mal formado", ...createWith({ id_repuesto_2: "REP1", cantidad_2: "1" }) },
  { name: "una cantidad de cero", ...createWith({ id_repuesto_1: RODAMIENTO, cantidad_1: "0" }) },
  { name: "una cantidad que no es numero", ...createWith({ id_repuesto_1: RODAMIENTO, cantidad_1: "dos" }) },
  { name: "una mano de obra negativa", ...createWith({ mano_obra: "-5" }) },
  { name: "una mano de obra de 1e12 pasa el esquema y llega a la base", ...createWith({ mano_obra: "1e12" }) },
  {
    name: "los opcionales vacios o ausentes se guardan como null",
    ...createWith({ tecnico_proveedor: null, mano_obra: null, observaciones: "" }),
  },
  { name: "WORKSHOP_MASTER: sin permiso, sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  {
    name: "datos invalidos lanzan los mensajes unidos sin tocar Prisma",
    ...createWith({ id_falla: "FAL", fecha_reparacion: "", estado_reparacion: "hecha" }),
  },
  { name: "un POST sin campos lanza los mensajes de Zod sin tocar Prisma", form: {} },
  { name: "la falla no existe", ...createWith({}, lookups({ failureState: null })) },
  { name: "una falla reparada no admite reparaciones", ...createWith({}, lookups({ failureState: "reparada" })) },
  { name: "una falla anulada no admite reparaciones", ...createWith({}, lookups({ failureState: "anulada" })) },
  {
    name: "el 30 de febrero pasa el esquema y se guarda como el 2 de marzo",
    ...createWith({ fecha_reparacion: "2026-02-30" }),
  },
  {
    name: "una fecha que no es fecha pasa el esquema y llega a la base como fecha invalida",
    ...createWith({ fecha_reparacion: "mañana" }),
  },
]);

defineCases("updateRepairStatusAction", updateRepairStatusAction, [
  { name: "de programada a ejecutada: la falla queda reparada y la maquina operativa", ...statusWith("ejecutada") },
  { name: "de programada a observada: falla en atencion y maquina en reparacion", ...statusWith("observada") },
  { name: "pedir el estado que ya tiene vuelve a escribir falla y maquina", ...statusWith("programada") },
  {
    name: "de observada a anulada: la falla vuelve a pendiente y la maquina no cambia",
    ...statusWith("anulada", "observada"),
  },
  { name: "WORKSHOP_MASTER: sin permiso, sin tocar Prisma", ...statusWith("ejecutada"), role: "WORKSHOP_MASTER" },
  {
    name: "una reparacion ejecutada no se modifica: el error se lanza dentro de la transaccion",
    ...statusWith("programada", "ejecutada"),
  },
  {
    name: "una reparacion anulada no se modifica: el error se lanza dentro de la transaccion",
    ...statusWith("programada", "anulada"),
  },
  { name: "la reparacion no existe", ...statusWith("ejecutada", null) },
  { name: "un estado que no existe lanza su mensaje sin tocar Prisma", ...statusWith("hecha") },
  { name: "un POST sin campos lanza los mensajes de Zod sin tocar Prisma", form: {} },
]);

// Los importes que se envian hoy a la base, fuera del snapshot: B2 los
// cambiara por los que la base guarda (redondeo de numeric(12,2)).
describe("createRepairAction calcula los importes en coma flotante", () => {
  type Recorded = { prisma?: string; args?: { data?: Record<string, unknown> } };

  async function written(fields: FormFields) {
    const { calls } = await runCase(createRepairAction, createWith(fields));
    const recorded = calls as Recorded[];

    return {
      repair: recorded.find((call) => call.prisma === "reparacion.create")?.args?.data,
      details: recorded
        .filter((call) => call.prisma === "detalle_repuesto_reparacion.create")
        .map((call) => call.args?.data),
    };
  }

  it("dos repuestos de 1,25 x 10,25 envian subtotales de 12,8125 y un total de 25,625", async () => {
    const { repair: created, details } = await written(twoSpareParts);

    expect(details.map((detail) => [detail?.cantidad, detail?.costo_unitario, detail?.subtotal])).toEqual([
      [1.25, 10.25, 12.8125],
      [1.25, 10.25, 12.8125],
    ]);
    expect(created).toMatchObject({ mano_obra: null, costo_total: 25.625 });
  });

  it("una cantidad de 1,005 entra al subtotal sin redondear, en coma flotante", async () => {
    const { repair: created, details } = await written({ id_repuesto_1: RODAMIENTO, cantidad_1: "1.005" });

    expect(details[0]).toMatchObject({ cantidad: 1.005, subtotal: 1.005 * 10.25 });
    expect(created).toMatchObject({ mano_obra: 150.5, costo_total: 150.5 + 1.005 * 10.25 });
  });

  it("una linea incompleta no deja detalle", async () => {
    const { details } = await written({ id_repuesto_1: RODAMIENTO, cantidad_1: "", id_repuesto_2: "", cantidad_2: "3" });

    expect(details).toEqual([]);
  });
});
