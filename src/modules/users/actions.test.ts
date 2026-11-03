import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createUserAction,
  resetUserPasswordAction,
  updateUserAction,
  updateUserStatusAction,
  type ResetPasswordFormState,
  type UserFormState,
} from "@/modules/users/actions";
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

// Caracterizacion de las acciones de Usuarios (entrega 10.7b), escrita antes de
// llevarlas al bloqueo de fila, al resultado de accion, al panel lateral y a la
// ventana de restablecer. Cada caso ejecuta la accion real con Prisma, la sesion,
// la cache, la bitacora, los correlativos y bcrypt simulados, y fija en un
// snapshot, en orden: la autorizacion con sus roles, las lecturas, la
// transaccion con sus escrituras y su final, los correlativos, el hash, la
// bitacora, las revalidaciones y la redireccion o el error con su mensaje exacto.
//
// Varios casos fijan defectos (hallazgos 18 a 22 de plan-10-7.md): cambian a
// proposito en sus commits fix. Desde B2 la edicion bloquea la fila; desde B3
// el estado y el restablecer escriben con updateMany en una transaccion.
//
// Credenciales: el doble de bcrypt registra solo la longitud en bytes de lo que
// recibe y devuelve un hash fijo. Cada caso comprueba ademas que ninguna
// contrasena del formulario aparece en las llamadas ni en la respuesta, y que
// toda lectura de usuario elige sus columnas sin clave_hash.

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
vi.mock("bcrypt", async () => {
  const { recordEffect } = await import("@/testing/page-characterization");
  const hash = async (value: string, cost: number) => {
    recordEffect("bcrypt.hash", { bytes: new TextEncoder().encode(value).length, cost });

    return "$2b$10$hash-de-prueba";
  };

  return { default: { hash }, hash };
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

const PASSWORD_FIELDS = ["password", "confirmPassword"];
const READ_METHODS = /^usuario\.(find|count|aggregate|groupBy)/;

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

function expectNoCredentials(form: FormFields, calls: RecordedCall[], result: unknown) {
  const recorded = JSON.stringify({ calls, result });

  for (const field of PASSWORD_FIELDS) {
    const value = form[field];

    if (value) {
      expect(recorded).not.toContain(value);
    }
  }

  for (const call of calls.filter(isPrismaCall).filter((item) => READ_METHODS.test(item.prisma))) {
    const select = (call.args as { select?: Record<string, unknown> } | undefined)?.select;

    expect(select, `${call.prisma} sin select`).toBeDefined();
    expect(select).not.toHaveProperty("clave_hash");
  }
}

function defineCases(name: string, run: (formData: FormData) => Promise<unknown>, cases: ActionCase[]) {
  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        const { calls, result } = await runCase(run, actionCase);

        expectAuthorizesBeforePrisma(calls);
        expectNoCredentials(actionCase.form, calls, result);
        expect(calls).toMatchSnapshot("llamadas");
        expect(result).toMatchSnapshot("resultado");
      });
    }
  });
}

// El alta y la edicion parten del estado inicial del panel, y el restablecer del
// de su ventana.
const withState =
  (action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>) =>
  (formData: FormData) =>
    action({ status: "idle" }, formData);

const withResetState =
  (action: (prev: ResetPasswordFormState, formData: FormData) => Promise<ResetPasswordFormState>) =>
  (formData: FormData) =>
    action({ status: "idle" }, formData);

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const SELF = "USU00000001";
const OTHER = "USU00000002";
const PASSWORD = "Clave#Segura1";
// 73 bytes: bcrypt solo usa los primeros 72.
const LONG_PASSWORD = `Aa1!${"x".repeat(69)}`;
// 40 caracteres y 80 bytes: cada vocal con tilde ocupa 2 bytes en UTF-8.
const ACCENTED_PASSWORD = `Aa1!${"á".repeat(36)}`;

const failWith = (error: Error) => () => {
  throw error;
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

const noDuplicate: DataOverrides = { "usuario.findFirst": null };
const duplicate = (correo: string, usuario: string): DataOverrides => ({
  "usuario.findFirst": { correo, usuario },
});
const noRole: DataOverrides = { "rol.findUnique": null };
// Un usuario inexistente: ninguna lectura lo encuentra y ninguna escritura
// condicionada lo afecta.
const noUser: DataOverrides = { "usuario.findUnique": null, "usuario.updateMany": { count: 0 } };

// updateMany afecta la fila solo si su estado guardado cumple la condicion del
// where, como haria la base con un compare-and-set.
const storedStatus = (estado: string) => (args: unknown) => {
  const condition = (args as { where?: { estado?: string | { not?: string } } }).where?.estado;
  const matches =
    condition === undefined ||
    (typeof condition === "string" ? condition === estado : condition.not !== estado);

  return { count: matches ? 1 : 0 };
};

const createForm: FormFields = {
  nombres: "Ana",
  apellidos: "Quispe",
  usuario: "aquispe",
  correo: "ana.quispe@example.com",
  rol: "SELLER",
  password: PASSWORD,
  confirmPassword: PASSWORD,
};

const createWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...createForm, ...fields },
  data: { ...noDuplicate, ...data },
});

const storedUser = (id: string, estado: string, rol: string): DataOverrides => ({
  "usuario.findUnique": { id_usuario: id, estado, rol: { nombre_rol: rol } },
});

const updateForm: FormFields = {
  id_usuario: OTHER,
  nombres: "Ana",
  apellidos: "Quispe",
  usuario: "aquispe",
  correo: "ana.quispe@example.com",
  rol: "SELLER",
};

const updateWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...updateForm, ...fields },
  data: { ...storedUser(OTHER, "activo", "SELLER"), ...noDuplicate, ...data },
});

const updateSelfWith = (fields: FormFields = {}) =>
  updateWith({ id_usuario: SELF, rol: "ADMIN", ...fields }, storedUser(SELF, "activo", "ADMIN"));

const statusWith = (estado: string, id: string | null = OTHER) => ({
  form: { id_usuario: id },
  data: {
    "usuario.findUnique": { id_usuario: OTHER, estado },
    "usuario.updateMany": storedStatus(estado),
  },
});

const resetWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { id_usuario: OTHER, password: PASSWORD, confirmPassword: PASSWORD, ...fields },
  data: { "usuario.findUnique": { id_usuario: OTHER }, ...data },
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createUserAction", withState(createUserAction), [
  { name: "ADMIN crea el usuario activo con su hash, correlativo y bitacora en la transaccion", ...createWith() },
  { name: "SELLER no puede crear", ...createWith(), role: "SELLER" },
  { name: "WORKSHOP_MASTER no puede crear", ...createWith(), role: "WORKSHOP_MASTER" },
  {
    name: "el correo se guarda en minusculas y sin espacios",
    ...createWith({ correo: "  Ana.Quispe@Example.COM ", nombres: "  Ana  " }),
  },
  { name: "nombres de una letra se rechazan", ...createWith({ nombres: "A" }) },
  { name: "un correo invalido se rechaza", ...createWith({ correo: "ana" }) },
  { name: "un rol fuera de la lista se rechaza", ...createWith({ rol: "ROOT" }) },
  { name: "una contrasena sin caracter especial se rechaza", ...createWith({ password: "ClaveSegura1", confirmPassword: "ClaveSegura1" }) },
  { name: "una contrasena corta se rechaza", ...createWith({ password: "Aa1!", confirmPassword: "Aa1!" }) },
  { name: "las contrasenas que no coinciden se rechazan", ...createWith({ confirmPassword: "Clave#Segura2" }) },
  { name: "sin confirmacion se rechaza", ...createWith({ confirmPassword: "" }) },
  {
    name: "una contrasena de 73 bytes se rechaza: bcrypt ignoraria el ultimo",
    ...createWith({ password: LONG_PASSWORD, confirmPassword: LONG_PASSWORD }),
  },
  {
    name: "una contrasena de 40 caracteres con tildes se rechaza: son 80 bytes",
    ...createWith({ password: ACCENTED_PASSWORD, confirmPassword: ACCENTED_PASSWORD }),
  },
  { name: "el rol no existe en la base", ...createWith({}, noRole) },
  { name: "el correo ya esta en uso", ...createWith({}, duplicate("ana.quispe@example.com", "otro")) },
  { name: "el usuario ya esta en uso", ...createWith({}, duplicate("otro@example.com", "aquispe")) },
  {
    name: "una carrera por el correo (P2002) responde como duplicado",
    ...createWith({}, { "usuario.create": failWith(uniqueViolation()) }),
  },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
]);

defineCases("updateUserAction", withState(updateUserAction), [
  { name: "ADMIN actualiza los datos sin cambiar el rol: una bitacora", ...updateWith() },
  { name: "cambiar el rol deja la bitacora del cambio", ...updateWith({ rol: "WORKSHOP_MASTER" }) },
  { name: "SELLER no puede actualizar", ...updateWith(), role: "SELLER" },
  { name: "sin id se rechaza sin tocar Prisma", ...updateWith({ id_usuario: "" }) },
  { name: "el usuario no existe", ...updateWith({}, noUser) },
  { name: "el rol no existe en la base", ...updateWith({}, noRole) },
  { name: "el administrador edita sus propios datos", ...updateSelfWith() },
  { name: "el administrador no puede quitarse el rol", ...updateSelfWith({ rol: "SELLER" }) },
  {
    name: "el correo ya esta en uso por otro",
    ...updateWith({}, duplicate("ana.quispe@example.com", "otro")),
  },
  {
    name: "el usuario ya esta en uso por otro",
    ...updateWith({}, duplicate("otro@example.com", "aquispe")),
  },
  {
    name: "una carrera por el correo (P2002) responde como duplicado",
    ...updateWith({}, { "usuario.update": failWith(uniqueViolation()) }),
  },
]);

// El estado pedido viaja en el formulario, como lo envia ConfirmActionButton.
const statusTo = (pedido: string | null, guardado: string, id: string | null = OTHER) => ({
  ...statusWith(guardado, id),
  form: { id_usuario: id, estado: pedido },
});

defineCases("updateUserStatusAction", (formData) => updateUserStatusAction({ status: "idle" }, formData), [
  { name: "activar un usuario inactivo escribe con su bitacora en la transaccion", ...statusTo("activo", "inactivo") },
  { name: "desactivar un usuario activo escribe con su bitacora en la transaccion", ...statusTo("inactivo", "activo") },
  { name: "activar un usuario activo no escribe y dice por que", ...statusTo("activo", "activo") },
  { name: "desactivar un usuario inactivo no escribe y dice por que", ...statusTo("inactivo", "inactivo") },
  { name: "el usuario no existe", form: { id_usuario: OTHER, estado: "activo" }, data: noUser },
  { name: "el administrador no puede desactivarse", ...statusTo("inactivo", "activo", SELF) },
  { name: "el administrador activo puede pedir activo: ya lo esta", ...statusTo("activo", "activo", SELF) },
  { name: "un estado desconocido se rechaza sin tocar Prisma", ...statusTo("bloqueado", "activo") },
  { name: "sin id se rechaza sin tocar Prisma", ...statusTo("activo", "inactivo", "") },
  { name: "un POST sin campos se rechaza sin tocar Prisma", ...statusTo(null, "inactivo", null) },
  { name: "SELLER no puede cambiar el estado", ...statusTo("activo", "inactivo"), role: "SELLER" },
  { name: "WORKSHOP_MASTER no puede cambiar el estado", ...statusTo("inactivo", "activo"), role: "WORKSHOP_MASTER" },
]);

defineCases("resetUserPasswordAction", withResetState(resetUserPasswordAction), [
  { name: "ADMIN restablece la contrasena con su bitacora en la transaccion", ...resetWith() },
  { name: "SELLER no puede restablecer", ...resetWith(), role: "SELLER" },
  { name: "sin id se rechaza sin tocar Prisma", ...resetWith({ id_usuario: "" }) },
  { name: "una contrasena debil se rechaza", ...resetWith({ password: "debil", confirmPassword: "debil" }) },
  { name: "las contrasenas que no coinciden se rechazan", ...resetWith({ confirmPassword: "Clave#Segura2" }) },
  {
    name: "una contrasena de 73 bytes se rechaza: bcrypt ignoraria el ultimo",
    ...resetWith({ password: LONG_PASSWORD, confirmPassword: LONG_PASSWORD }),
  },
  { name: "el usuario no existe", ...resetWith({}, noUser) },
  { name: "el restablecer de uno mismo se permite", ...resetWith({ id_usuario: SELF }, { "usuario.findUnique": { id_usuario: SELF } }) },
]);

// ---------------------------------------------------------------------------
// Bloqueo de fila (B2, hallazgo 21)
// ---------------------------------------------------------------------------

// La edicion decide con el rol y el estado guardados (reglas de uno mismo y
// bitacoras de cambio): bloquea la fila del usuario antes de leerlos, dentro de
// la transaccion que escribe, para que dos ediciones simultaneas no registren
// cambios que no hubo.
describe("updateUserAction bloquea la fila del usuario", () => {
  const update = withState(updateUserAction);
  const reads = (call: PrismaCall) => call.prisma === "usuario.findUnique";

  it.each([
    { name: "editar otro usuario", id: OTHER, actionCase: updateWith({ rol: "WORKSHOP_MASTER" }) },
    { name: "editar el propio usuario", id: SELF, actionCase: updateSelfWith() },
    { name: "quitarse el rol de administrador", id: SELF, actionCase: updateSelfWith({ rol: "SELLER" }) },
  ])("$name: bloquea antes de leer", async ({ id, actionCase }) => {
    const { calls } = await runCase(update, actionCase);

    expectRowLockedBefore(calls, { table: "usuario", id, reads });
  });

  it("un usuario inexistente se decide dentro de la transaccion y no escribe", async () => {
    const { calls, result } = await runCase(update, updateWith({}, noUser));
    const lock = calls.findIndex((call) => isRowLock(call, "usuario", OTHER));

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(calls.filter(isPrismaCall).map((call) => call.prisma)).not.toContain("usuario.update");
    expect(result).toEqual({
      estado: expect.objectContaining({ status: "error", error: "El usuario no existe." }),
    });
  });
});

// ---------------------------------------------------------------------------
// Escrituras atomicas (B3, hallazgos 18 y 22)
// ---------------------------------------------------------------------------

// El estado se cambia con un compare-and-set: la escritura misma decide si el
// usuario tenia el estado opuesto, sin leerlo antes, y la bitacora va en la
// misma transaccion. El restablecer escribe el hash con updateMany, que no
// devuelve la fila (con clave_hash) y dice por su count si el usuario existe.
function prismaCalls(calls: RecordedCall[]) {
  return calls.filter(isPrismaCall);
}

function auditLogs(calls: RecordedCall[]) {
  return calls.flatMap((call) =>
    "effect" in call && call.effect === "registerAuditLog" ? [call.args as Record<string, unknown>] : [],
  );
}

describe("activar y desactivar escriben con compare-and-set", () => {
  const run = (formData: FormData) => updateUserStatusAction({ status: "idle" }, formData);

  it.each([
    { name: "activar", estado: "inactivo", siguiente: "activo" },
    { name: "desactivar", estado: "activo", siguiente: "inactivo" },
  ])("$name escribe en la transaccion sin leer antes", async ({ estado, siguiente }) => {
    const { calls } = await runCase(run, statusTo(siguiente, estado));
    const names = prismaCalls(calls).map((call) => call.prisma);

    expect(names).not.toContain("usuario.findUnique");
    expect(names).not.toContain("usuario.update");
    expect(auditLogs(calls)).toEqual([expect.objectContaining({ enTransaccion: true })]);
  });
});

describe("restablecer escribe el hash con updateMany en la transaccion", () => {
  const reset = withResetState(resetUserPasswordAction);

  it("no lee el usuario ni recibe su fila", async () => {
    const { calls } = await runCase(reset, resetWith());
    const names = prismaCalls(calls).map((call) => call.prisma);

    expect(names).not.toContain("usuario.findUnique");
    expect(names).not.toContain("usuario.update");
    expect(prismaCalls(calls).filter((call) => call.prisma === "usuario.updateMany")).toEqual([
      {
        prisma: "usuario.updateMany",
        args: { where: { id_usuario: OTHER }, data: { clave_hash: "$2b$10$hash-de-prueba" } },
      },
    ]);
    expect(auditLogs(calls)).toEqual([expect.objectContaining({ enTransaccion: true })]);
  });

  it("un usuario inexistente responde sin bitacora", async () => {
    const { calls, result } = await runCase(reset, resetWith({}, noUser));

    expect(auditLogs(calls)).toEqual([]);
    expect(result).toEqual({ estado: expect.objectContaining({ status: "error", error: "El usuario no existe." }) });
  });
});

// ---------------------------------------------------------------------------
// Resultado de accion (B5, D2 y D6)
// ---------------------------------------------------------------------------

// Desde el panel lateral, el alta y la edicion autorizan con getAuthorizedSession
// y devuelven el resultado (FormActionState) en lugar de redirigir. Los valores
// devueltos son los campos de texto y el rol: nunca las contrasenas, que no deben
// volver al navegador (D6). La edicion ya no recibe el estado (D2).
const TEXT_VALUES = {
  nombres: "Ana",
  apellidos: "Quispe",
  usuario: "aquispe",
  correo: "ana.quispe@example.com",
  rol: "SELLER",
};

describe("el alta y la edicion devuelven el resultado", () => {
  const create = withState(createUserAction);
  const update = withState(updateUserAction);

  it.each([
    { name: "el alta", run: create, actionCase: createWith() },
    { name: "la edicion", run: update, actionCase: updateWith() },
  ])("$name sin permiso responde con un error, sin redirigir", async ({ run, actionCase }) => {
    const { calls, result } = await runCase(run, { ...actionCase, role: "SELLER" });

    expect(calls.filter(isPrismaCall)).toEqual([]);
    expect(result).toEqual({
      estado: expect.objectContaining({ status: "error", error: "No tienes permisos para gestionar usuarios." }),
    });
  });

  it("el alta guardada devuelve el id y los valores sin contrasenas", async () => {
    const { result } = await runCase(create, createWith());

    expect(result).toEqual({
      estado: {
        status: "success",
        data: { id_usuario: "USU00000012" },
        values: TEXT_VALUES,
        operationId: "operacion-de-prueba",
      },
    });
  });

  it.each([
    { name: "un error del esquema", actionCase: createWith({ confirmPassword: "Clave#Segura2" }) },
    { name: "un duplicado", actionCase: createWith({}, duplicate("ana.quispe@example.com", "otro")) },
    { name: "una carrera P2002", actionCase: createWith({}, { "usuario.create": failWith(uniqueViolation()) }) },
  ])("$name devuelve los valores sin contrasenas", async ({ actionCase }) => {
    const { result } = await runCase(create, actionCase);
    const estado = (result as { estado: { status: string; values: Record<string, string> } }).estado;

    expect(estado.status).toBe("error");
    expect(estado.values).toEqual(TEXT_VALUES);
  });

  it("la edicion ignora el estado: solo cambia desde la fila", async () => {
    const { calls, result } = await runCase(update, updateWith({ estado: "inactivo" }));
    const write = calls.filter(isPrismaCall).find((call) => call.prisma === "usuario.update");

    expect((write?.args as { data: Record<string, unknown> }).data).not.toHaveProperty("estado");
    expect(auditLogs(calls).map((log) => log.accion)).toEqual(["actualizar"]);
    expect(result).toEqual({ estado: expect.objectContaining({ status: "success", data: { id_usuario: OTHER } }) });
  });
});

// ---------------------------------------------------------------------------
// Restablecer en ventana (B6, D3 y D6)
// ---------------------------------------------------------------------------

// Desde la ventana de la fila, el restablecer autoriza con getAuthorizedSession y
// devuelve el resultado en lugar de redirigir. No devuelve ningun valor: lo unico
// que se escribe son las contrasenas, que nunca vuelven al navegador.
describe("el restablecer devuelve el resultado", () => {
  const reset = withResetState(resetUserPasswordAction);

  it("sin permiso responde con un error, sin redirigir ni tocar Prisma", async () => {
    const { calls, result } = await runCase(reset, { ...resetWith(), role: "SELLER" });

    expect(calls.filter(isPrismaCall)).toEqual([]);
    expect(result).toEqual({
      estado: {
        status: "error",
        error: "No tienes permisos para gestionar usuarios.",
        values: {},
        operationId: "operacion-de-prueba",
      },
    });
  });

  it("guardado devuelve el id, sin valores, y revalida la lista", async () => {
    const { calls, result } = await runCase(reset, resetWith());

    expect(result).toEqual({
      estado: { status: "success", data: { id_usuario: OTHER }, values: {}, operationId: "operacion-de-prueba" },
    });
    expect(calls.some((call) => "effect" in call && call.effect === "revalidatePath")).toBe(true);
  });

  it.each([
    { name: "una contrasena debil", actionCase: resetWith({ password: "debil", confirmPassword: "debil" }) },
    { name: "un usuario inexistente", actionCase: resetWith({}, noUser) },
  ])("$name devuelve el error sin valores", async ({ actionCase }) => {
    const { result } = await runCase(reset, actionCase);

    expect(result).toEqual({ estado: expect.objectContaining({ status: "error", values: {} }) });
  });
});

// ---------------------------------------------------------------------------
// Estado desde la fila (B7, D4)
// ---------------------------------------------------------------------------

// Activar y desactivar son una sola accion para ConfirmActionButton: recibe el
// estado pedido, lo fija con compare-and-set y devuelve el resultado en lugar de
// redirigir. Un rechazo queda en la confirmacion con su motivo, tambien el de
// desactivarse a uno mismo, que antes llegaba como aviso por la URL.
describe("updateUserStatusAction", () => {
  const run = (formData: FormData) => updateUserStatusAction({ status: "idle" }, formData);
  const requested = (estado: string, stored: string, id: string | null = OTHER) => ({
    ...statusWith(stored, id),
    form: { id_usuario: id, estado },
  });

  it.each([
    { pedido: "inactivo", guardado: "activo" },
    { pedido: "activo", guardado: "inactivo" },
  ])("fija $pedido con compare-and-set y su bitacora en la transaccion", async ({ pedido, guardado }) => {
    const { calls, result } = await runCase(run, requested(pedido, guardado));

    expect(prismaCalls(calls).filter((call) => call.prisma === "usuario.updateMany")).toEqual([
      {
        prisma: "usuario.updateMany",
        args: { where: { id_usuario: OTHER, estado: { not: pedido } }, data: { estado: pedido } },
      },
    ]);
    expect(auditLogs(calls)).toEqual([
      expect.objectContaining({ accion: pedido === "activo" ? "activar" : "inactivar", enTransaccion: true }),
    ]);
    expect(result).toEqual({
      estado: { status: "success", data: { estado: pedido }, values: { id: OTHER }, operationId: "operacion-de-prueba" },
    });
  });

  it.each([
    { name: "sin permiso", actionCase: { ...requested("inactivo", "activo"), role: "SELLER" as const }, error: "No tienes permisos para gestionar usuarios." },
    { name: "desactivarse a uno mismo", actionCase: requested("inactivo", "activo", SELF), error: "No puedes desactivar tu propio usuario." },
    { name: "un estado desconocido", actionCase: requested("bloqueado", "activo"), error: "Selecciona un estado válido." },
    { name: "sin usuario", actionCase: requested("inactivo", "activo", ""), error: "El usuario no existe." },
  ])("$name se rechaza sin tocar Prisma", async ({ actionCase, error }) => {
    const { calls, result } = await runCase(run, actionCase);

    expect(prismaCalls(calls)).toEqual([]);
    expect(result).toEqual({ estado: expect.objectContaining({ status: "error", error }) });
  });

  it.each([
    { name: "desactivar un inactivo", actionCase: requested("inactivo", "inactivo"), error: "El usuario ya está inactivo." },
    { name: "activar un activo", actionCase: requested("activo", "activo"), error: "El usuario ya está activo." },
    { name: "un usuario inexistente", actionCase: { ...requested("activo", "inactivo"), data: noUser }, error: "El usuario no existe." },
  ])("$name responde con su motivo, sin bitacora ni revalidar", async ({ actionCase, error }) => {
    const { calls, result } = await runCase(run, actionCase);

    expect(auditLogs(calls)).toEqual([]);
    expect(calls.some((call) => "effect" in call && call.effect === "revalidatePath")).toBe(false);
    expect(result).toEqual({ estado: expect.objectContaining({ status: "error", error }) });
  });
});
