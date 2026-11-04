import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createAttendanceAction } from "@/modules/staff/attendance/actions";
import {
  createOperatorAction,
  updateOperatorStatusAction,
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
  expectRowLockedBefore,
  isPrismaCall,
  isRowLock,
  type DataOverrides,
  type PrismaCall,
  type RecordedCall,
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
// Cada respuesta lleva un operationId aleatorio; en los snapshots, uno fijo.
vi.mock("@/lib/action-result", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/action-result")>()),
  newOperationId: () => "operacion-de-prueba",
}));
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
// inicial de su formulario. Desde A6 devuelven el resultado (FormActionState).
const withState =
  (action: (prev: OperatorFormState, formData: FormData) => Promise<OperatorFormState>) =>
  (formData: FormData) =>
    action({ status: "idle" }, formData);

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

// updateManyAndReturn afecta la fila solo si su estado guardado cumple la
// condicion del where, como haria la base con un compare-and-set.
const storedOperatorStatus = (estado: string) => (args: unknown) => {
  const condition = (args as { where?: { estado?: string | { not?: string } } }).where?.estado;
  const matches =
    condition === undefined ||
    (typeof condition === "string" ? condition === estado : condition.not !== estado);

  return matches ? [{ nombres: "Luis", apellidos: "Huaman" }] : [];
};

// El boton de la fila envia el estado que pide ("activo" o "inactivo"). Desde A7
// la accion devuelve el resultado; sin filas lee el operario solo para explicar
// el rechazo.
const requestStatus = (pedido: string | null, guardado: string, id: string | null = OPERATOR) => ({
  form: { id_operario: id, estado: pedido },
  data: {
    "operario.updateManyAndReturn": storedOperatorStatus(guardado),
    "operario.findUnique": { id_operario: OPERATOR },
  },
});

const updateStatus = (formData: FormData) => updateOperatorStatusAction({ status: "idle" }, formData);

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
    name: "una tarifa de 1e12 se rechaza: desborda Decimal(12,2)",
    ...createOperatorWith({ tarifa: "1000000000000" }),
  },
  {
    name: "una tarifa de 0.004 pasa: la columna la deja en 0, una tarifa valida",
    ...createOperatorWith({ tarifa: "0.004" }),
  },
  {
    name: "el 30 de febrero se rechaza",
    ...createOperatorWith({ fecha_ingreso: "2026-02-30" }),
  },
  {
    name: "el alta ignora el estado del formulario: nace activo",
    ...createOperatorWith({ estado: "inactivo" }),
  },
  { name: "un estado desconocido en el formulario se ignora", ...createOperatorWith({ estado: "retirado" }) },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
]);

defineCases("updateOperatorAction", withState(updateOperatorAction), [
  {
    name: "ADMIN actualiza bloqueando la fila, con escritura y bitacora en la transaccion",
    ...updateOperatorWith(),
  },
  { name: "WORKSHOP_MASTER no puede actualizar", ...updateOperatorWith(), role: "WORKSHOP_MASTER" },
  { name: "sin id se rechaza sin tocar Prisma", ...updateOperatorWith({ id_operario: "" }) },
  {
    name: "el operario no existe",
    ...updateOperatorWith({}, { "operario.findUnique": null }),
  },
  { name: "datos invalidos se rechazan sin tocar Prisma", ...updateOperatorWith({ apellidos: "H" }) },
  {
    name: "otro operario con los mismos datos se rechaza",
    ...updateOperatorWith({}, { "operario.findFirst": { id_operario: OTHER_OPERATOR } }),
  },
  {
    name: "encontrarse a si mismo como duplicado no es duplicado",
    ...updateOperatorWith({}, { "operario.findFirst": { id_operario: OPERATOR } }),
  },
  {
    name: "la edicion ignora el estado del formulario",
    ...updateOperatorWith({ estado: "inactivo" }),
  },
]);

defineCases("updateOperatorStatusAction", updateStatus, [
  { name: "inactivar un operario activo", ...requestStatus("inactivo", "activo") },
  { name: "activar un operario inactivo", ...requestStatus("activo", "inactivo") },
  {
    name: "inactivar un operario ya inactivo responde el motivo sin bitacora",
    ...requestStatus("inactivo", "inactivo"),
  },
  { name: "WORKSHOP_MASTER no puede cambiar el estado", ...requestStatus("inactivo", "activo"), role: "WORKSHOP_MASTER" },
  { name: "sin id se rechaza sin tocar Prisma", ...requestStatus("inactivo", "activo", "") },
  {
    name: "un operario inexistente responde el motivo sin bitacora",
    form: { id_operario: OPERATOR, estado: "inactivo" },
    data: { "operario.updateManyAndReturn": [], "operario.findUnique": null },
  },
]);

// ---------------------------------------------------------------------------
// Bloqueo de fila y compare-and-set de operarios (A2, hallazgo 58)
// ---------------------------------------------------------------------------

const prismaCalls = (calls: RecordedCall[]) => calls.filter(isPrismaCall).map((call) => call.prisma);
const auditCalls = (calls: RecordedCall[]) =>
  calls.filter((call) => "effect" in call && call.effect === "registerAuditLog");

// La edicion decide con lo guardado (existe, duplicados) y escribe: bloquea la
// fila del operario antes de leerla, dentro de la transaccion que escribe y deja
// la bitacora.
describe("updateOperatorAction bloquea la fila del operario", () => {
  const update = withState(updateOperatorAction);
  const reads = (call: PrismaCall) =>
    call.prisma === "operario.findUnique" || call.prisma === "operario.findFirst";

  it("bloquea antes de leer y escribe con la bitacora en la transaccion", async () => {
    const { calls } = await runCase(update, updateOperatorWith());

    expectRowLockedBefore(calls, { table: "operario", id: OPERATOR, reads });
    expect(calls.filter(isPrismaCall).filter((call) => call.fueraDeTransaccion)).toEqual([]);
    expect(auditCalls(calls)).toEqual([
      expect.objectContaining({ args: expect.objectContaining({ enTransaccion: true }) }),
    ]);
  });

  it("un operario inexistente se decide dentro de la transaccion y no escribe", async () => {
    const { calls, result } = await runCase(
      update,
      updateOperatorWith({}, { "operario.findUnique": null }),
    );

    expect(calls.some((call) => isRowLock(call, "operario", OPERATOR))).toBe(true);
    expect(prismaCalls(calls)).not.toContain("operario.update");
    expect(result).toEqual({
      estado: expect.objectContaining({ status: "error", error: "El operario no existe." }),
    });
  });

  it("un duplicado de otro operario se decide dentro de la transaccion y no escribe", async () => {
    const { calls, result } = await runCase(
      update,
      updateOperatorWith({}, { "operario.findFirst": { id_operario: OTHER_OPERATOR } }),
    );

    expectRowLockedBefore(calls, { table: "operario", id: OPERATOR, reads });
    expect(prismaCalls(calls)).not.toContain("operario.update");
    expect(result).toEqual({
      estado: expect.objectContaining({ error: "Ya existe otro operario registrado con esos datos." }),
    });
  });
});

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

// Desde A8 el registro de asistencia parte del estado inicial de su formulario y
// devuelve el resultado (FormActionState).
const createAttendance = (formData: FormData) => createAttendanceAction({ status: "idle" }, formData);

defineCases("createAttendanceAction", createAttendance, [
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
    name: "el 30 de febrero se rechaza",
    ...attendanceWith({ fecha: "2026-02-30" }),
  },
  {
    name: "una fecha que no es fecha se rechaza",
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
    name: "una carrera por la misma fecha (P2002) responde como duplicado",
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

// Desde A9 el registro y la anulacion de tareas parten del estado inicial de su
// formulario y devuelven el resultado.
const createTask = (formData: FormData) => createOperatorTaskAction({ status: "idle" }, formData);
const cancelTask = (formData: FormData) => cancelOperatorTaskAction({ status: "idle" }, formData);

defineCases("createOperatorTaskAction", createTask, [
  { name: "ADMIN registra la tarea sin etapa, con bitacora en la transaccion", ...taskWith() },
  { name: "WORKSHOP_MASTER tambien registra", ...taskWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede registrar", ...taskWith(), role: "SELLER" },
  {
    name: "con una etapa de la ruta de la orden",
    ...taskWith({ id_etapa_ruta: STAGE }, activeStage(ROUTE)),
  },
  { name: "sin horas: horas null", ...taskWith({ horas_dedicadas: "" }) },
  {
    name: "3.005 horas se envian tal cual: la columna guarda 3.01",
    ...taskWith({ horas_dedicadas: "3.005" }),
  },
  {
    name: "0.004 horas se envian tal cual: la columna guarda 0.00",
    ...taskWith({ horas_dedicadas: "0.004" }),
  },
  { name: "mas de 24 horas se rechazan", ...taskWith({ horas_dedicadas: "24.5" }) },
  { name: "horas negativas se rechazan", ...taskWith({ horas_dedicadas: "-1" }) },
  { name: "horas que no son numero se rechazan", ...taskWith({ horas_dedicadas: "abc" }) },
  { name: "una descripcion corta se rechaza", ...taskWith({ descripcion: "Cort" }) },
  { name: "un estado fuera de la lista se rechaza", ...taskWith({ estado: "pausada" }) },
  {
    name: "el alta rechaza una tarea anulada enviada a mano",
    ...taskWith({ estado: "anulada" }),
  },
  {
    name: "el 30 de febrero se rechaza",
    ...taskWith({ fecha_tarea: "2026-02-30" }),
  },
  {
    name: "el operario no existe o esta inactivo",
    ...taskWith({}, { "operario.findFirst": null }),
  },
  {
    name: "la orden no existe o esta anulada",
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

// updateMany afecta la tarea solo si no esta anulada, como haria la base con
// un compare-and-set; null: la tarea no existe.
const storedTask = (estado: string | null): DataOverrides => ({
  "tarea_operario.updateMany": (args: unknown) => {
    const condition = (args as { where?: { estado?: { not?: string } } }).where?.estado;

    return { count: estado !== null && condition?.not !== estado ? 1 : 0 };
  },
  "tarea_operario.findUnique": estado === null ? null : { id_tarea_operario: TASK, estado },
});

const cancelWith = (estado: string | null, id: string | null = TASK) => ({
  form: { id_tarea_operario: id },
  data: storedTask(estado),
});

defineCases("cancelOperatorTaskAction", cancelTask, [
  {
    name: "ADMIN anula con compare-and-set y la bitacora en la transaccion",
    ...cancelWith("registrada"),
  },
  { name: "WORKSHOP_MASTER tambien anula", ...cancelWith("en_proceso"), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede anular", ...cancelWith("registrada"), role: "SELLER" },
  { name: "una tarea terminada tambien se anula", ...cancelWith("terminada") },
  { name: "una tarea ya anulada se rechaza", ...cancelWith("anulada") },
  { name: "una tarea inexistente se rechaza", ...cancelWith(null) },
  { name: "sin id se rechaza sin tocar Prisma", ...cancelWith("registrada", "") },
]);

// ---------------------------------------------------------------------------
// Tareas: orden bloqueada al crear y anulacion con compare-and-set (A3)
// ---------------------------------------------------------------------------

// Hallazgo 63: crear una tarea decide con la orden (no anulada, su ruta), el
// operario y la etapa. Bloquea la orden, el padre, antes de leerla y del
// correlativo, y decide dentro de la transaccion que escribe.
describe("createOperatorTaskAction bloquea la orden de trabajo", () => {
  const reads = (call: PrismaCall) =>
    ["operario.findFirst", "orden_trabajo.findFirst", "etapa_ruta.findUnique"].includes(call.prisma);
  const lockIndex = (calls: RecordedCall[]) =>
    calls.findIndex((call) => isRowLock(call, "orden_trabajo", WORK_ORDER));

  it("bloquea antes de leer y antes del correlativo", async () => {
    const { calls } = await runCase(
      createTask,
      taskWith({ id_etapa_ruta: STAGE }, activeStage(ROUTE)),
    );
    const correlative = calls.findIndex(
      (call) => "effect" in call && call.effect === "getNextCorrelativeId",
    );

    expectRowLockedBefore(calls, { table: "orden_trabajo", id: WORK_ORDER, reads });
    expect(lockIndex(calls)).toBeLessThan(correlative);
  });

  it.each([
    {
      name: "una orden anulada",
      actionCase: taskWith({}, { "orden_trabajo.findFirst": null }),
      error: "La orden de trabajo seleccionada no existe o está anulada.",
    },
    {
      name: "un operario inactivo",
      actionCase: taskWith({}, { "operario.findFirst": null }),
      error: "El operario seleccionado no existe o está inactivo.",
    },
    {
      name: "una etapa de otra ruta",
      actionCase: taskWith({ id_etapa_ruta: STAGE }, activeStage("RUT00000009")),
      error: "La etapa seleccionada no pertenece a la ruta de fabricación de la orden.",
    },
  ])("$name se decide dentro de la transaccion y no escribe", async ({ actionCase, error }) => {
    const { calls, result } = await runCase(createTask, actionCase);

    expect(lockIndex(calls)).toBeGreaterThanOrEqual(0);
    expect(prismaCalls(calls)).not.toContain("tarea_operario.create");
    expect(auditCalls(calls)).toEqual([]);
    expect(result).toEqual({ estado: expect.objectContaining({ status: "error", error }) });
  });
});

// Hallazgo 61: anular leia el estado y escribia aparte; dos anulaciones a la vez
// dejaban dos bitacoras.
describe("anular una tarea escribe con compare-and-set", () => {
  const cancel = (estado: string | null) => ({ form: { id_tarea_operario: TASK }, data: storedTask(estado) });

  it("anula con una sola sentencia y la bitacora en la transaccion", async () => {
    const { calls, result } = await runCase(cancelTask, cancel("registrada"));
    const write = calls.filter(isPrismaCall).find((call) => call.prisma === "tarea_operario.updateMany");

    expect(prismaCalls(calls)).not.toContain("tarea_operario.update");
    expect(prismaCalls(calls)).not.toContain("tarea_operario.findUnique");
    expect(write?.args).toEqual({
      where: { id_tarea_operario: TASK, estado: { not: "anulada" } },
      data: { estado: "anulada" },
    });
    expect(auditCalls(calls)).toEqual([
      expect.objectContaining({ args: expect.objectContaining({ accion: "anular", enTransaccion: true }) }),
    ]);
    expect(result).toEqual({
      estado: expect.objectContaining({ status: "success", data: { estado: "anulada" } }),
    });
  });

  it.each([
    { name: "una tarea ya anulada (doble clic)", estado: "anulada", error: "La tarea ya se encuentra anulada." },
    { name: "una tarea inexistente", estado: null, error: "La tarea seleccionada no existe." },
  ])("$name no escribe bitacora y explica el rechazo", async ({ estado, error }) => {
    const { calls, result } = await runCase(cancelTask, cancel(estado));

    expect(prismaCalls(calls)).toContain("tarea_operario.updateMany");
    expect(auditCalls(calls)).toEqual([]);
    expect(result).toEqual({ estado: expect.objectContaining({ status: "error", error }) });
  });
});

// ---------------------------------------------------------------------------
// Asistencia: duplicado dentro de la transaccion y carrera P2002 (A4)
// ---------------------------------------------------------------------------

// Hallazgo 60: la comprobacion del duplicado iba fuera de la transaccion y una
// carrera por la misma fecha chocaba con uq_asistencia_operario_fecha (P2002),
// que llegaba sin tratar a la pagina de error. La restriccion unica es la
// garantia: la accion decide dentro de la transaccion y traduce su P2002 al
// mismo mensaje del duplicado.
describe("createAttendanceAction decide el duplicado dentro de la transaccion", () => {
  const DUPLICATE = "Este operario ya tiene asistencia registrada en la fecha seleccionada.";
  const transactionStart = (calls: RecordedCall[]) =>
    calls.findIndex((call) => "effect" in call && call.effect === "prisma.$transaction");

  it("lee el operario y el duplicado dentro de la transaccion que escribe", async () => {
    const { calls } = await runCase(createAttendance, attendanceWith());
    const start = transactionStart(calls);
    const reads = calls.flatMap((call, index) =>
      isPrismaCall(call) && ["operario.findFirst", "asistencia.findFirst"].includes(call.prisma) ? [index] : [],
    );

    expect(start).toBeGreaterThanOrEqual(0);
    expect(reads).toHaveLength(2);
    expect(Math.min(...reads)).toBeGreaterThan(start);
  });

  it("un duplicado se decide dentro de la transaccion y no escribe", async () => {
    const { calls, result } = await runCase(
      createAttendance,
      attendanceWith({}, { "asistencia.findFirst": { id_asistencia: "ASI00000001" } }),
    );

    expect(transactionStart(calls)).toBeGreaterThanOrEqual(0);
    expect(prismaCalls(calls)).not.toContain("asistencia.create");
    expect(result).toEqual({
      estado: expect.objectContaining({ status: "error", error: DUPLICATE, fieldErrors: { fecha: [DUPLICATE] } }),
    });
  });

  it("una carrera por la misma fecha (P2002) responde con el mensaje del duplicado", async () => {
    const { calls, result } = await runCase(
      createAttendance,
      attendanceWith({}, { "asistencia.create": failWith(uniqueViolation()) }),
    );

    expect(auditCalls(calls)).toEqual([]);
    expect(result).toEqual({
      estado: expect.objectContaining({ status: "error", error: DUPLICATE, fieldErrors: { fecha: [DUPLICATE] } }),
    });
  });

  it("otro error de Prisma se propaga sin cambiar", async () => {
    const foreignKey = new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
      code: "P2003",
      clientVersion: "test",
    });
    const { result } = await runCase(
      createAttendance,
      attendanceWith({}, { "asistencia.create": failWith(foreignKey) }),
    );

    expect(result).toBe("error: Foreign key constraint failed");
  });
});

// ---------------------------------------------------------------------------
// Horas de tarea redondeadas por la columna (A5, hallazgo 62)
// ---------------------------------------------------------------------------

// horas_dedicadas es numeric(5,2) y redondea a dos decimales alejandose del cero.
// toFixed(2) redondeaba sobre el binario: 3.005 quedaba en 3.00 y la columna
// guarda 3.01. La accion envia el valor tal cual y deja el redondeo a la base.
describe("createOperatorTaskAction deja el redondeo de las horas a la columna", () => {
  it.each([
    { horas: "3.005", enviado: "3.005" },
    { horas: "4.5", enviado: "4.5" },
    { horas: "8", enviado: "8" },
  ])("$horas horas se envian como $enviado", async ({ horas, enviado }) => {
    const { calls } = await runCase(createTask, taskWith({ horas_dedicadas: horas }));
    const create = calls.filter(isPrismaCall).find((call) => call.prisma === "tarea_operario.create");

    expect((create?.args as { data: { horas_dedicadas: unknown } }).data.horas_dedicadas).toBe(enviado);
  });
});

// ---------------------------------------------------------------------------
// Alta y edicion de operarios con resultado de accion (A6)
// ---------------------------------------------------------------------------

// Desde A6 el alta y la edicion se usan en el panel lateral: devuelven el
// resultado en lugar de redirigir, y sin permiso responden con un error sin tocar
// Prisma (se corrige la desviacion de 2 funciones). El estado ya no viaja en el
// formulario: nace activo y cambia solo desde la fila (D3).
describe("el alta y la edicion de operarios devuelven el resultado", () => {
  const idle = { status: "idle" } as const;
  const create = (formData: FormData) =>
    (createOperatorAction as unknown as (prev: unknown, formData: FormData) => Promise<unknown>)(idle, formData);
  const update = (formData: FormData) =>
    (updateOperatorAction as unknown as (prev: unknown, formData: FormData) => Promise<unknown>)(idle, formData);
  const VALUES = {
    nombres: "Luis",
    apellidos: "Huaman",
    cargo: "Soldador",
    especialidad: "Soldadura MIG",
    telefono: "987654321",
    direccion: "Av. Industrial 123",
    modalidad_pago: "semanal",
    tarifa: "80.50",
    fecha_ingreso: "2026-03-02",
    observaciones: "",
  };

  it("sin permiso responde con un error, sin redirigir ni tocar Prisma", async () => {
    const { calls, result } = await runCase(create, { ...createOperatorWith(), role: "WORKSHOP_MASTER" });

    expect(calls.filter(isPrismaCall)).toEqual([]);
    expect(calls).toContainEqual({ authz: "getAuthorizedSession", roles: ["ADMIN"] });
    expect(result).toEqual({
      estado: {
        status: "error",
        error: "No tienes permisos para gestionar operarios.",
        values: VALUES,
        operationId: expect.any(String),
      },
    });
  });

  it("el alta guardada devuelve el id y los valores, nace activo y revalida sin redirigir", async () => {
    const { calls, result } = await runCase(create, createOperatorWith({ estado: "inactivo" }));
    const write = calls.filter(isPrismaCall).find((call) => call.prisma === "operario.create");

    expect((write?.args as { data: { estado: string } }).data.estado).toBe("activo");
    expect(calls).toContainEqual({ effect: "revalidatePath", args: "/dashboard/staff/operators" });
    expect(result).toEqual({
      estado: {
        status: "success",
        data: { id_operario: "OPE00000012" },
        values: VALUES,
        operationId: expect.any(String),
      },
    });
  });

  it("un dato invalido devuelve el error del campo con lo enviado", async () => {
    const { result } = await runCase(create, createOperatorWith({ nombres: "L" }));

    expect(result).toEqual({
      estado: {
        status: "error",
        error: "Revisa los datos del operario.",
        fieldErrors: { nombres: ["Los nombres deben tener al menos 2 caracteres."] },
        values: { ...VALUES, nombres: "L" },
        operationId: expect.any(String),
      },
    });
  });

  it("la edicion guardada ignora el estado: solo cambia desde la fila", async () => {
    const { calls, result } = await runCase(update, updateOperatorWith({ estado: "inactivo" }));
    const write = calls.filter(isPrismaCall).find((call) => call.prisma === "operario.update");

    expect((write?.args as { data: Record<string, unknown> }).data).not.toHaveProperty("estado");
    expect(result).toEqual({
      estado: {
        status: "success",
        data: { id_operario: OPERATOR },
        values: VALUES,
        operationId: expect.any(String),
      },
    });
  });

  it("la edicion de un operario inexistente devuelve el error con lo enviado", async () => {
    const { result } = await runCase(update, updateOperatorWith({}, { "operario.findUnique": null }));

    expect(result).toEqual({
      estado: {
        status: "error",
        error: "El operario no existe.",
        values: VALUES,
        operationId: expect.any(String),
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Activar e inactivar operario desde la fila con resultado (A7)
// ---------------------------------------------------------------------------

// Desde A7 activar e inactivar son una sola accion que recibe el estado pedido
// ("activo" o "inactivo", como usuarios), lo fija con compare-and-set y
// devuelve el resultado para ConfirmActionButton en lugar de redirigir. Un rechazo
// no revalida: la lista repintada quitaria el boton y su mensaje.
describe("updateOperatorStatusAction devuelve el resultado", () => {
  const run = updateStatus;
  const status = (pedido: string | null, guardado: string | null, id: string | null = OPERATOR) => ({
    form: { id_operario: id, estado: pedido },
    data: {
      "operario.updateManyAndReturn": guardado === null ? [] : storedOperatorStatus(guardado),
      "operario.findUnique": guardado === null ? null : { id_operario: OPERATOR },
    },
  });
  const revalidations = (calls: RecordedCall[]) =>
    calls.filter((call) => "effect" in call && call.effect === "revalidatePath");

  it("inactivar escribe con compare-and-set y la bitacora, revalida y devuelve el estado", async () => {
    const { calls, result } = await runCase(run, status("inactivo", "activo"));
    const write = calls.filter(isPrismaCall).find((call) => call.prisma === "operario.updateManyAndReturn");

    // Compara y escribe en una sola sentencia: no lee antes ni usa update.
    expect(prismaCalls(calls)).not.toContain("operario.findUnique");
    expect(prismaCalls(calls)).not.toContain("operario.update");
    expect(calls).toContainEqual({ authz: "getAuthorizedSession", roles: ["ADMIN"] });
    expect(write?.args).toEqual({
      where: { id_operario: OPERATOR, estado: { not: "inactivo" } },
      data: { estado: "inactivo" },
      select: { nombres: true, apellidos: true },
    });
    expect(auditCalls(calls)).toEqual([
      expect.objectContaining({
        args: expect.objectContaining({ accion: "inactivar", detalle: "Operario inactivado: Luis Huaman", enTransaccion: true }),
      }),
    ]);
    expect(revalidations(calls).length).toBeGreaterThan(0);
    expect(result).toEqual({
      estado: { status: "success", data: { estado: "inactivo" }, values: { id: OPERATOR }, operationId: "operacion-de-prueba" },
    });
  });

  it("activar devuelve el estado activo", async () => {
    const { result } = await runCase(run, status("activo", "inactivo"));

    expect(result).toEqual({
      estado: { status: "success", data: { estado: "activo" }, values: { id: OPERATOR }, operationId: "operacion-de-prueba" },
    });
  });

  it.each([
    { motivo: "ya inactivo", caso: status("inactivo", "inactivo"), error: "El operario ya está inactivo." },
    { motivo: "inexistente", caso: status("inactivo", null), error: "El operario no existe." },
  ])("un operario $motivo responde el motivo sin bitacora ni revalidar", async ({ caso, error }) => {
    const { calls, result } = await runCase(run, caso);

    expect(auditCalls(calls)).toEqual([]);
    expect(revalidations(calls)).toEqual([]);
    expect(result).toEqual({
      estado: { status: "error", error, values: { id: OPERATOR }, operationId: "operacion-de-prueba" },
    });
  });

  it.each([
    { motivo: "un estado pedido desconocido", caso: status("true", "activo"), error: "Selecciona un estado válido." },
    { motivo: "sin id", caso: status("inactivo", "activo", ""), error: "El operario no existe." },
  ])("$motivo se rechaza sin tocar Prisma", async ({ caso, error }) => {
    const { calls, result } = await runCase(run, caso);

    expect(calls.filter(isPrismaCall)).toEqual([]);
    expect(result).toEqual({ estado: expect.objectContaining({ status: "error", error }) });
  });

  it("sin permiso responde con un error sin tocar Prisma", async () => {
    const { calls, result } = await runCase(run, { ...status("inactivo", "activo"), role: "WORKSHOP_MASTER" });

    expect(calls.filter(isPrismaCall)).toEqual([]);
    expect(result).toEqual({
      estado: expect.objectContaining({ status: "error", error: "No tienes permisos para gestionar operarios." }),
    });
  });
});

// ---------------------------------------------------------------------------
// Asistencia con resultado de accion (A8)
// ---------------------------------------------------------------------------

// Desde A8 el registro de asistencia se usa en el panel lateral: devuelve el
// resultado en lugar de lanzar o redirigir. Cada rechazo queda junto a su campo
// con lo enviado; sin permiso responde con un error sin tocar Prisma.
describe("createAttendanceAction devuelve el resultado", () => {
  const run = createAttendance;
  const VALUES = {
    id_operario: OPERATOR,
    fecha: "2026-07-15",
    hora_ingreso: "08:00",
    hora_salida: "17:00",
    tardanza: false,
    falta: false,
    observaciones: "",
  };
  const DUPLICATE = "Este operario ya tiene asistencia registrada en la fecha seleccionada.";
  const errorWith = (error: string, fieldErrors: Record<string, string[]> | undefined, values = VALUES) => ({
    estado: { status: "error", error, fieldErrors, values, operationId: "operacion-de-prueba" },
  });

  it("guardada devuelve el id y los valores y revalida sin redirigir", async () => {
    const { calls, result } = await runCase(run, attendanceWith({ tardanza: "on" }));

    expect(calls).toContainEqual({ authz: "getAuthorizedSession", roles: ["ADMIN", "WORKSHOP_MASTER"] });
    expect(calls).toContainEqual({ effect: "revalidatePath", args: "/dashboard/staff/attendance" });
    expect(result).toEqual({
      estado: {
        status: "success",
        data: { id_asistencia: "ASI00000012" },
        values: { ...VALUES, tardanza: true },
        operationId: "operacion-de-prueba",
      },
    });
  });

  it("sin permiso responde con un error, sin tocar Prisma", async () => {
    const { calls, result } = await runCase(run, { ...attendanceWith(), role: "SELLER" });

    expect(calls.filter(isPrismaCall)).toEqual([]);
    expect(result).toEqual(errorWith("No tienes permisos para registrar asistencia.", undefined));
  });

  it("un dato invalido devuelve el error junto a su campo", async () => {
    const { result } = await runCase(run, attendanceWith({ hora_salida: "07:00" }));

    expect(result).toEqual(
      errorWith(
        "Revisa los datos de la asistencia.",
        { hora_salida: ["La hora de salida debe ser mayor que la hora de ingreso."] },
        { ...VALUES, hora_salida: "07:00" },
      ),
    );
  });

  it("un operario inactivo devuelve el error en el operario", async () => {
    const { result } = await runCase(run, attendanceWith({}, { "operario.findFirst": null }));

    expect(result).toEqual(
      errorWith("El operario seleccionado no existe o está inactivo.", {
        id_operario: ["El operario seleccionado no existe o está inactivo."],
      }),
    );
  });

  it.each<{ motivo: string; data: DataOverrides }>([
    { motivo: "el duplicado", data: { "asistencia.findFirst": { id_asistencia: "ASI00000001" } } },
    { motivo: "la carrera P2002", data: { "asistencia.create": failWith(uniqueViolation()) } },
  ])("$motivo devuelve el error en la fecha", async ({ data }) => {
    const { result } = await runCase(run, attendanceWith({}, data));

    expect(result).toEqual(errorWith(DUPLICATE, { fecha: [DUPLICATE] }));
  });
});

// ---------------------------------------------------------------------------
// Tareas con resultado de accion (A9)
// ---------------------------------------------------------------------------

// Desde A9 el registro de tareas se usa en el panel lateral y anular desde la fila
// con ConfirmActionButton: las dos acciones devuelven el resultado en lugar de
// lanzar o redirigir. Cada rechazo del registro queda junto a su campo.
describe("createOperatorTaskAction devuelve el resultado", () => {
  const run = createTask;
  const VALUES = {
    id_operario: OPERATOR,
    id_orden_trabajo: WORK_ORDER,
    id_etapa_ruta: "",
    fecha_tarea: "2026-07-15",
    descripcion: "Corte de piezas para lote de lampas",
    horas_dedicadas: "4.5",
    estado: "registrada",
    observaciones: "",
  };
  const rejected = (error: string, field: string, values: Record<string, string> = VALUES) => ({
    estado: { status: "error", error, fieldErrors: { [field]: [error] }, values, operationId: "operacion-de-prueba" },
  });

  it("guardada devuelve el id y los valores y revalida sin redirigir", async () => {
    const { calls, result } = await runCase(run, taskWith());

    expect(calls).toContainEqual({ authz: "getAuthorizedSession", roles: ["ADMIN", "WORKSHOP_MASTER"] });
    expect(calls).toContainEqual({ effect: "revalidatePath", args: "/dashboard/staff/tasks" });
    expect(result).toEqual({
      estado: {
        status: "success",
        data: { id_tarea_operario: "TAR00000012" },
        values: VALUES,
        operationId: "operacion-de-prueba",
      },
    });
  });

  it("sin permiso responde con un error, sin tocar Prisma", async () => {
    const { calls, result } = await runCase(run, { ...taskWith(), role: "SELLER" });

    expect(calls.filter(isPrismaCall)).toEqual([]);
    expect(result).toEqual({
      estado: {
        status: "error",
        error: "No tienes permisos para registrar tareas.",
        values: VALUES,
        operationId: "operacion-de-prueba",
      },
    });
  });

  it("un dato invalido devuelve el error junto a su campo", async () => {
    const { result } = await runCase(run, taskWith({ horas_dedicadas: "25" }));

    expect(result).toEqual({
      estado: {
        status: "error",
        error: "Revisa los datos de la tarea.",
        fieldErrors: { horas_dedicadas: ["Las horas dedicadas no pueden superar 24 horas."] },
        values: { ...VALUES, horas_dedicadas: "25" },
        operationId: "operacion-de-prueba",
      },
    });
  });

  it.each<{ motivo: string; caso: ReturnType<typeof taskWith>; error: string; campo: string }>([
    {
      motivo: "un operario inactivo",
      caso: taskWith({}, { "operario.findFirst": null }),
      error: "El operario seleccionado no existe o está inactivo.",
      campo: "id_operario",
    },
    {
      motivo: "una orden anulada",
      caso: taskWith({}, { "orden_trabajo.findFirst": null }),
      error: "La orden de trabajo seleccionada no existe o está anulada.",
      campo: "id_orden_trabajo",
    },
    {
      motivo: "una etapa de otra ruta",
      caso: taskWith({ id_etapa_ruta: STAGE }, activeStage("RUT00000009")),
      error: "La etapa seleccionada no pertenece a la ruta de fabricación de la orden.",
      campo: "id_etapa_ruta",
    },
  ])("$motivo devuelve el error en su campo", async ({ caso, error, campo }) => {
    const { result } = await runCase(run, caso);

    expect(result).toEqual(rejected(error, campo, { ...VALUES, id_etapa_ruta: caso.form.id_etapa_ruta ?? "" }));
  });
});

describe("cancelOperatorTaskAction devuelve el resultado", () => {
  const run = cancelTask;
  const cancel = (estado: string | null, id: string | null = TASK) => ({
    form: { id_tarea_operario: id },
    data: storedTask(estado),
  });
  const revalidations = (calls: RecordedCall[]) =>
    calls.filter((call) => "effect" in call && call.effect === "revalidatePath");

  it("anular devuelve el estado anulado y revalida", async () => {
    const { calls, result } = await runCase(run, cancel("registrada"));

    expect(calls).toContainEqual({ authz: "getAuthorizedSession", roles: ["ADMIN", "WORKSHOP_MASTER"] });
    expect(revalidations(calls).length).toBeGreaterThan(0);
    expect(result).toEqual({
      estado: { status: "success", data: { estado: "anulada" }, values: { id: TASK }, operationId: "operacion-de-prueba" },
    });
  });

  it.each([
    { motivo: "ya anulada", estado: "anulada", error: "La tarea ya se encuentra anulada." },
    { motivo: "inexistente", estado: null, error: "La tarea seleccionada no existe." },
  ])("una tarea $motivo responde el motivo sin revalidar", async ({ estado, error }) => {
    const { calls, result } = await runCase(run, cancel(estado));

    expect(revalidations(calls)).toEqual([]);
    expect(result).toEqual({
      estado: { status: "error", error, values: { id: TASK }, operationId: "operacion-de-prueba" },
    });
  });

  it("sin permiso responde con un error, sin tocar Prisma", async () => {
    const { calls, result } = await runCase(run, { ...cancel("registrada"), role: "SELLER" });

    expect(calls.filter(isPrismaCall)).toEqual([]);
    expect(result).toEqual({
      estado: expect.objectContaining({ status: "error", error: "No tienes permisos para registrar tareas." }),
    });
  });
});
