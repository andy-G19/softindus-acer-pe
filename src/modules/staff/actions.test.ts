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

// updateManyAndReturn afecta la fila solo si su estado guardado cumple la
// condicion del where, como haria la base con un compare-and-set.
const storedOperatorStatus = (estado: string) => (args: unknown) => {
  const condition = (args as { where?: { estado?: string | { not?: string } } }).where?.estado;
  const matches =
    condition === undefined ||
    (typeof condition === "string" ? condition === estado : condition.not !== estado);

  return matches ? [{ nombres: "Luis", apellidos: "Huaman" }] : [];
};

// Desde A2 el boton envia el estado que pide ("true" activa, "false"
// inactiva), como los catalogos desde la 10.1 (sendsRequestedStatus).
const requestStatus = (pedido: string | null, guardado: string, id: string | null = OPERATOR) => ({
  form: { id_operario: id, estado: pedido },
  data: { "operario.updateManyAndReturn": storedOperatorStatus(guardado) },
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
    name: "la edicion cambia el estado desde el formulario (hallazgo 59)",
    ...updateOperatorWith({ estado: "inactivo" }),
  },
]);

defineCases("toggleOperatorStatusAction", toggleOperatorStatusAction, [
  { name: "inactivar un operario activo", ...requestStatus("false", "activo") },
  { name: "activar un operario inactivo", ...requestStatus("true", "inactivo") },
  {
    name: "inactivar un operario ya inactivo vuelve a la lista sin escribir la bitacora",
    ...requestStatus("false", "inactivo"),
  },
  { name: "WORKSHOP_MASTER no puede cambiar el estado", ...requestStatus("false", "activo"), role: "WORKSHOP_MASTER" },
  { name: "sin id vuelve a la lista sin tocar Prisma", ...requestStatus("false", "activo", "") },
  {
    name: "un operario inexistente vuelve a la lista sin escribir la bitacora",
    form: { id_operario: OPERATOR, estado: "false" },
    data: { "operario.updateManyAndReturn": [] },
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
    expect(result).toEqual({ estado: { error: "El operario no existe." } });
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

describe("activar e inactivar operario escriben con compare-and-set", () => {
  it("inactivar fija el estado pedido con una sola sentencia y la bitacora en la transaccion", async () => {
    const { calls, result } = await runCase(toggleOperatorStatusAction, requestStatus("false", "activo"));
    const write = calls.filter(isPrismaCall).find((call) => call.prisma === "operario.updateManyAndReturn");

    expect(prismaCalls(calls)).not.toContain("operario.findUnique");
    expect(prismaCalls(calls)).not.toContain("operario.update");
    expect(write?.args).toEqual({
      where: { id_operario: OPERATOR, estado: { not: "inactivo" } },
      data: { estado: "inactivo" },
      select: { nombres: true, apellidos: true },
    });
    expect(auditCalls(calls)).toEqual([
      expect.objectContaining({
        args: expect.objectContaining({
          accion: "inactivar",
          detalle: "Operario inactivado: Luis Huaman",
          enTransaccion: true,
        }),
      }),
    ]);
    expect(result).toBe("redirect:/dashboard/staff/operators?toast=operator-deactivated");
  });

  it("activar fija el estado pedido", async () => {
    const { calls, result } = await runCase(toggleOperatorStatusAction, requestStatus("true", "inactivo"));

    expect(auditCalls(calls)).toEqual([
      expect.objectContaining({ args: expect.objectContaining({ accion: "activar", enTransaccion: true }) }),
    ]);
    expect(result).toBe("redirect:/dashboard/staff/operators?toast=operator-activated");
  });

  it("con la lista vieja, Inactivar sobre un inactivo no lo activa ni deja bitacora", async () => {
    const { calls, result } = await runCase(toggleOperatorStatusAction, requestStatus("false", "inactivo"));

    expect(auditCalls(calls)).toEqual([]);
    expect(prismaCalls(calls)).not.toContain("operario.update");
    expect(result).toBe("redirect:/dashboard/staff/operators");
  });

  it.each([
    { name: "sin estado pedido", pedido: null },
    { name: "un estado pedido desconocido", pedido: "activo" },
  ])("$name vuelve a la lista sin tocar Prisma", async ({ pedido }) => {
    const { calls, result } = await runCase(toggleOperatorStatusAction, requestStatus(pedido, "activo"));

    expect(calls.filter(isPrismaCall)).toEqual([]);
    expect(result).toBe("redirect:/dashboard/staff/operators");
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

defineCases("cancelOperatorTaskAction", cancelOperatorTaskAction, [
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
      createOperatorTaskAction,
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
    const { calls, result } = await runCase(createOperatorTaskAction, actionCase);

    expect(lockIndex(calls)).toBeGreaterThanOrEqual(0);
    expect(prismaCalls(calls)).not.toContain("tarea_operario.create");
    expect(auditCalls(calls)).toEqual([]);
    expect(result).toBe(`error: ${error}`);
  });
});

// Hallazgo 61: anular leia el estado y escribia aparte; dos anulaciones a la vez
// dejaban dos bitacoras.
describe("anular una tarea escribe con compare-and-set", () => {
  const cancel = (estado: string | null) => ({ form: { id_tarea_operario: TASK }, data: storedTask(estado) });

  it("anula con una sola sentencia y la bitacora en la transaccion", async () => {
    const { calls, result } = await runCase(cancelOperatorTaskAction, cancel("registrada"));
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
    expect(result).toBe("redirect:/dashboard/staff/tasks?toast=operator-task-annulled");
  });

  it.each([
    { name: "una tarea ya anulada (doble clic)", estado: "anulada", error: "La tarea ya se encuentra anulada." },
    { name: "una tarea inexistente", estado: null, error: "La tarea seleccionada no existe." },
  ])("$name no escribe bitacora y explica el rechazo", async ({ estado, error }) => {
    const { calls, result } = await runCase(cancelOperatorTaskAction, cancel(estado));

    expect(prismaCalls(calls)).toContain("tarea_operario.updateMany");
    expect(auditCalls(calls)).toEqual([]);
    expect(result).toBe(`error: ${error}`);
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
    const { calls } = await runCase(createAttendanceAction, attendanceWith());
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
      createAttendanceAction,
      attendanceWith({}, { "asistencia.findFirst": { id_asistencia: "ASI00000001" } }),
    );

    expect(transactionStart(calls)).toBeGreaterThanOrEqual(0);
    expect(prismaCalls(calls)).not.toContain("asistencia.create");
    expect(result).toBe(`error: ${DUPLICATE}`);
  });

  it("una carrera por la misma fecha (P2002) responde con el mensaje del duplicado", async () => {
    const { calls, result } = await runCase(
      createAttendanceAction,
      attendanceWith({}, { "asistencia.create": failWith(uniqueViolation()) }),
    );

    expect(auditCalls(calls)).toEqual([]);
    expect(result).toBe(`error: ${DUPLICATE}`);
  });

  it("otro error de Prisma se propaga sin cambiar", async () => {
    const foreignKey = new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
      code: "P2003",
      clientVersion: "test",
    });
    const { result } = await runCase(
      createAttendanceAction,
      attendanceWith({}, { "asistencia.create": failWith(foreignKey) }),
    );

    expect(result).toBe("error: Foreign key constraint failed");
  });
});
