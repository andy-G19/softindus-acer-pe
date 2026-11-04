import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createAttendanceAction } from "@/modules/staff/attendance/actions";
import {
  createOperatorAction,
  toggleOperatorStatusAction,
  updateOperatorAction,
  type OperatorFormState,
} from "@/modules/staff/operators/actions";
import {
  cancelOperatorTaskAction,
  createOperatorTaskAction,
} from "@/modules/staff/tasks/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de Personal (entrega 10.8a), escrita antes de
// llevarlas al bloqueo de fila, al resultado de accion y al panel lateral. Cada
// caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion con
// sus roles, las lecturas, las escrituras (dentro o fuera de la transaccion), el
// final de la transaccion, los correlativos, la bitacora, las revalidaciones y la
// redireccion o el error con su mensaje exacto.
//
// Varios casos fijan defectos (hallazgos 58 a 63 y 68 a 70 de plan-10-8.md):
// cambian a proposito en sus commits fix. Las planillas y los pagos a operario
// son de la entrega 11 y no entran aqui.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

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

// El alta y la edicion de operarios usan useActionState: parten del estado
// inicial de su formulario.
const withState =
  (action: (prev: OperatorFormState, formData: FormData) => Promise<OperatorFormState>) =>
  (formData: FormData) =>
    action({ error: "" }, formData);

const failWith = (error: Error) => () => {
  throw error;
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

// ---------------------------------------------------------------------------
// Operarios
// ---------------------------------------------------------------------------

const OPERATOR = "OPE00000003";
const OTHER_OPERATOR = "OPE00000004";

const operatorForm: FormFields = {
  nombres: "Luis",
  apellidos: "Huaman",
  cargo: "Soldador",
  especialidad: "Soldadura MIG",
  telefono: "987654321",
  direccion: "Av. Industrial 123",
  modalidad_pago: "semanal",
  tarifa: "80.50",
  fecha_ingreso: "2026-03-02",
  estado: "activo",
  observaciones: "",
};

const noDuplicateOperator: DataOverrides = { "operario.findFirst": null };

const createOperatorWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...operatorForm, ...fields },
  data: { ...noDuplicateOperator, ...data },
});

const updateOperatorWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { id_operario: OPERATOR, ...operatorForm, ...fields },
  data: {
    "operario.findUnique": { id_operario: OPERATOR },
    ...noDuplicateOperator,
    ...data,
  },
});

const toggleWith = (estado: string, id: string | null = OPERATOR) => ({
  form: { id_operario: id },
  data: {
    "operario.findUnique": { nombres: "Luis", apellidos: "Huaman", estado },
  },
});

defineCases("createOperatorAction", withState(createOperatorAction), [
  { name: "ADMIN registra el operario con correlativo y bitacora en la transaccion", ...createOperatorWith() },
  { name: "WORKSHOP_MASTER no puede registrar", ...createOperatorWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede registrar", ...createOperatorWith(), role: "SELLER" },
  {
    name: "los campos opcionales vacios se guardan como null",
    ...createOperatorWith({
      cargo: "",
      especialidad: "",
      telefono: "",
      direccion: "",
      tarifa: "",
      fecha_ingreso: "",
    }),
  },
  { name: "sin telefono, el duplicado se busca solo por nombres y apellidos", ...createOperatorWith({ telefono: "" }) },
  {
    name: "un operario con los mismos datos se rechaza",
    ...createOperatorWith({}, { "operario.findFirst": { id_operario: OTHER_OPERATOR } }),
  },
  { name: "nombres de una letra se rechazan", ...createOperatorWith({ nombres: "L" }) },
  { name: "una modalidad fuera de la lista se rechaza", ...createOperatorWith({ modalidad_pago: "diaria" }) },
  { name: "una tarifa negativa se rechaza", ...createOperatorWith({ tarifa: "-1" }) },
  { name: "una tarifa que no es numero se rechaza", ...createOperatorWith({ tarifa: "abc" }) },
  {
    name: "una tarifa de 1e12 pasa el esquema aunque desborda Decimal(12,2) (hallazgo 69)",
    ...createOperatorWith({ tarifa: "1000000000000" }),
  },
  {
    name: "una tarifa de 0.004 pasa y la columna la deja en 0 (hallazgo 69)",
    ...createOperatorWith({ tarifa: "0.004" }),
  },
  {
    name: "el 30 de febrero se guarda como 2 de marzo (hallazgo 68)",
    ...createOperatorWith({ fecha_ingreso: "2026-02-30" }),
  },
  {
    name: "el alta acepta el estado inactivo desde el formulario (hallazgo 59)",
    ...createOperatorWith({ estado: "inactivo" }),
  },
  { name: "un estado fuera de la lista se rechaza", ...createOperatorWith({ estado: "retirado" }) },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
]);

defineCases("updateOperatorAction", withState(updateOperatorAction), [
  {
    name: "ADMIN actualiza: escritura y bitacora fuera de la transaccion y sin bloqueo (hallazgo 58)",
    ...updateOperatorWith(),
  },
  { name: "WORKSHOP_MASTER no puede actualizar", ...updateOperatorWith(), role: "WORKSHOP_MASTER" },
  { name: "sin id se rechaza sin tocar Prisma", ...updateOperatorWith({ id_operario: "" }) },
  {
    name: "el operario no existe",
    ...updateOperatorWith({}, { "operario.findUnique": null }),
  },
  { name: "datos invalidos se rechazan despues de leer el operario", ...updateOperatorWith({ apellidos: "H" }) },
  {
    name: "otro operario con los mismos datos se rechaza",
    ...updateOperatorWith({}, { "operario.findFirst": { id_operario: OTHER_OPERATOR } }),
  },
  {
    name: "encontrarse a si mismo como duplicado no es duplicado",
    ...updateOperatorWith({}, { "operario.findFirst": { id_operario: OPERATOR } }),
  },
  {
    name: "la edicion cambia el estado desde el formulario (hallazgo 59)",
    ...updateOperatorWith({ estado: "inactivo" }),
  },
]);

defineCases("toggleOperatorStatusAction", toggleOperatorStatusAction, [
  { name: "un operario activo pasa a inactivo", ...toggleWith("activo") },
  {
    name: "un operario inactivo pasa a activo: el boton no dice que estado pide (hallazgo 58)",
    ...toggleWith("inactivo"),
  },
  { name: "WORKSHOP_MASTER no puede cambiar el estado", ...toggleWith("activo"), role: "WORKSHOP_MASTER" },
  { name: "sin id vuelve a la lista sin tocar Prisma", ...toggleWith("activo", "") },
  {
    name: "un operario inexistente vuelve a la lista",
    form: { id_operario: OPERATOR },
    data: { "operario.findUnique": null },
  },
]);

// ---------------------------------------------------------------------------
// Asistencia
// ---------------------------------------------------------------------------

const attendanceForm: FormFields = {
  id_operario: OPERATOR,
  fecha: "2026-07-15",
  hora_ingreso: "08:00",
  hora_salida: "17:00",
  tardanza: null,
  falta: null,
  observaciones: "",
};

const activeOperator: DataOverrides = { "operario.findFirst": { id_operario: OPERATOR } };
const noAttendance: DataOverrides = { "asistencia.findFirst": null };

const attendanceWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...attendanceForm, ...fields },
  data: { ...activeOperator, ...noAttendance, ...data },
});

defineCases("createAttendanceAction", createAttendanceAction, [
  { name: "ADMIN registra ingreso y salida: 9 horas, con bitacora en la transaccion", ...attendanceWith() },
  { name: "WORKSHOP_MASTER tambien registra", ...attendanceWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede registrar", ...attendanceWith(), role: "SELLER" },
  { name: "20 minutos se guardan como 0.33 horas", ...attendanceWith({ hora_salida: "08:20" }) },
  { name: "solo ingreso: sin horas trabajadas", ...attendanceWith({ hora_salida: "" }) },
  {
    name: "con tardanza se guarda la tardanza",
    ...attendanceWith({ tardanza: "on" }),
  },
  {
    name: "una falta no guarda horas y descarta la tardanza",
    ...attendanceWith({ hora_ingreso: "", hora_salida: "", falta: "on", tardanza: "on" }),
  },
  { name: "una falta con horas se rechaza", ...attendanceWith({ falta: "on" }) },
  { name: "sin falta ni ingreso se rechaza", ...attendanceWith({ hora_ingreso: "", hora_salida: "" }) },
  { name: "salida antes del ingreso se rechaza", ...attendanceWith({ hora_salida: "07:00" }) },
  { name: "salida igual al ingreso se rechaza", ...attendanceWith({ hora_salida: "08:00" }) },
  { name: "una hora con otro formato se rechaza", ...attendanceWith({ hora_ingreso: "8:00" }) },
  {
    name: "unas observaciones de mas de 500 caracteres se rechazan",
    ...attendanceWith({ observaciones: "x".repeat(501) }),
  },
  {
    name: "el 30 de febrero se guarda como 2 de marzo (hallazgo 68)",
    ...attendanceWith({ fecha: "2026-02-30" }),
  },
  {
    name: "una fecha que no es fecha llega a Prisma como Invalid Date (hallazgo 68)",
    ...attendanceWith({ fecha: "abc" }),
  },
  {
    name: "el operario no existe o esta inactivo",
    ...attendanceWith({}, { "operario.findFirst": null }),
  },
  {
    name: "el operario ya tiene asistencia en esa fecha",
    ...attendanceWith({}, { "asistencia.findFirst": { id_asistencia: "ASI00000001" } }),
  },
  {
    name: "una carrera por la misma fecha (P2002) lanza el error de Prisma (hallazgo 60)",
    ...attendanceWith({}, { "asistencia.create": failWith(uniqueViolation()) }),
  },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
]);

// ---------------------------------------------------------------------------
// Tareas de operario
// ---------------------------------------------------------------------------

const WORK_ORDER = "OTR00000006";
const ROUTE = "RUT00000002";
const STAGE = "ETA00000005";

const taskForm: FormFields = {
  id_operario: OPERATOR,
  id_orden_trabajo: WORK_ORDER,
  id_etapa_ruta: "",
  fecha_tarea: "2026-07-15",
  descripcion: "Corte de piezas para lote de lampas",
  horas_dedicadas: "4.5",
  estado: "registrada",
  observaciones: "",
};

const openWorkOrder: DataOverrides = {
  "orden_trabajo.findFirst": { id_orden_trabajo: WORK_ORDER, id_ruta: ROUTE },
};
const activeStage = (id_ruta: string, estado = true): DataOverrides => ({
  "etapa_ruta.findUnique": { id_etapa_ruta: STAGE, id_ruta, estado },
});

const taskWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...taskForm, ...fields },
  data: { ...activeOperator, ...openWorkOrder, ...data },
});

defineCases("createOperatorTaskAction", createOperatorTaskAction, [
  { name: "ADMIN registra la tarea sin etapa, con bitacora en la transaccion", ...taskWith() },
  { name: "WORKSHOP_MASTER tambien registra", ...taskWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede registrar", ...taskWith(), role: "SELLER" },
  {
    name: "con una etapa de la ruta de la orden",
    ...taskWith({ id_etapa_ruta: STAGE }, activeStage(ROUTE)),
  },
  { name: "sin horas: horas null", ...taskWith({ horas_dedicadas: "" }) },
  {
    name: "3.005 horas se guardan como 3.00 por toFixed: la columna daria 3.01 (hallazgo 62)",
    ...taskWith({ horas_dedicadas: "3.005" }),
  },
  {
    name: "0.004 horas pasan y se guardan como 0.00 (hallazgo 62)",
    ...taskWith({ horas_dedicadas: "0.004" }),
  },
  { name: "mas de 24 horas se rechazan", ...taskWith({ horas_dedicadas: "24.5" }) },
  { name: "horas negativas se rechazan", ...taskWith({ horas_dedicadas: "-1" }) },
  { name: "horas que no son numero se rechazan", ...taskWith({ horas_dedicadas: "abc" }) },
  { name: "una descripcion corta se rechaza", ...taskWith({ descripcion: "Cort" }) },
  { name: "un estado fuera de la lista se rechaza", ...taskWith({ estado: "pausada" }) },
  {
    name: "el alta acepta una tarea ya anulada si se envia a mano (hallazgo 70)",
    ...taskWith({ estado: "anulada" }),
  },
  {
    name: "el 30 de febrero se guarda como 2 de marzo (hallazgo 68)",
    ...taskWith({ fecha_tarea: "2026-02-30" }),
  },
  {
    name: "el operario no existe o esta inactivo",
    ...taskWith({}, { "operario.findFirst": null }),
  },
  {
    name: "la orden no existe o esta anulada: se decide fuera de la transaccion (hallazgo 63)",
    ...taskWith({}, { "orden_trabajo.findFirst": null }),
  },
  {
    name: "la etapa no existe",
    ...taskWith({ id_etapa_ruta: STAGE }, { "etapa_ruta.findUnique": null }),
  },
  {
    name: "la etapa esta inactiva",
    ...taskWith({ id_etapa_ruta: STAGE }, activeStage(ROUTE, false)),
  },
  {
    name: "la orden no tiene ruta y se eligio etapa",
    ...taskWith(
      { id_etapa_ruta: STAGE },
      {
        ...activeStage(ROUTE),
        "orden_trabajo.findFirst": { id_orden_trabajo: WORK_ORDER, id_ruta: null },
      },
    ),
  },
  {
    name: "la etapa es de otra ruta",
    ...taskWith({ id_etapa_ruta: STAGE }, activeStage("RUT00000009")),
  },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
]);

const TASK = "TAR00000007";

const cancelWith = (estado: string | null, id: string | null = TASK) => ({
  form: { id_tarea_operario: id },
  data: {
    "tarea_operario.findUnique": estado === null ? null : { id_tarea_operario: TASK, estado },
  },
});

defineCases("cancelOperatorTaskAction", cancelOperatorTaskAction, [
  {
    name: "ADMIN anula: lee y escribe sin compare-and-set (hallazgo 61)",
    ...cancelWith("registrada"),
  },
  { name: "WORKSHOP_MASTER tambien anula", ...cancelWith("en_proceso"), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede anular", ...cancelWith("registrada"), role: "SELLER" },
  { name: "una tarea terminada tambien se anula", ...cancelWith("terminada") },
  { name: "una tarea ya anulada se rechaza", ...cancelWith("anulada") },
  { name: "una tarea inexistente se rechaza", ...cancelWith(null) },
  { name: "sin id se rechaza sin tocar Prisma", ...cancelWith("registrada", "") },
]);
