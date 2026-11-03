import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  activateUserAction,
  createUserAction,
  deactivateUserAction,
  resetUserPasswordAction,
  updateUserAction,
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

const withState =
  (action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>) =>
  (formData: FormData) =>
    action({ error: "" }, formData);

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
  estado: "activo",
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
    name: "una contrasena de 73 bytes pasa aunque bcrypt ignora el ultimo",
    ...createWith({ password: LONG_PASSWORD, confirmPassword: LONG_PASSWORD }),
  },
  {
    name: "una contrasena de 40 caracteres con tildes pasa con 80 bytes",
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
  { name: "ADMIN actualiza los datos sin cambiar rol ni estado: una bitacora", ...updateWith() },
  { name: "cambiar el rol deja la bitacora del cambio", ...updateWith({ rol: "WORKSHOP_MASTER" }) },
  { name: "desactivar desde la edicion deja la bitacora de inactivar", ...updateWith({ estado: "inactivo" }) },
  {
    name: "activar desde la edicion deja la bitacora de activar",
    ...updateWith({}, storedUser(OTHER, "inactivo", "SELLER")),
  },
  { name: "cambiar rol y estado deja tres bitacoras", ...updateWith({ rol: "ADMIN", estado: "inactivo" }) },
  { name: "SELLER no puede actualizar", ...updateWith(), role: "SELLER" },
  { name: "sin id se rechaza sin tocar Prisma", ...updateWith({ id_usuario: "" }) },
  { name: "un estado desconocido se rechaza", ...updateWith({ estado: "bloqueado" }) },
  { name: "sin estado se rechaza", ...updateWith({ estado: null }) },
  { name: "el usuario no existe", ...updateWith({}, noUser) },
  { name: "el rol no existe en la base", ...updateWith({}, noRole) },
  { name: "el administrador edita sus propios datos", ...updateSelfWith() },
  { name: "el administrador no puede quitarse el rol", ...updateSelfWith({ rol: "SELLER" }) },
  { name: "el administrador no puede desactivarse", ...updateSelfWith({ estado: "inactivo" }) },
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

defineCases("activateUserAction", activateUserAction, [
  { name: "activar un usuario inactivo escribe con su bitacora en la transaccion", ...statusWith("inactivo") },
  { name: "activar un usuario activo no escribe", ...statusWith("activo") },
  { name: "el usuario no existe", form: { id_usuario: OTHER }, data: noUser },
  { name: "sin id vuelve a la lista sin tocar Prisma", ...statusWith("inactivo", "") },
  { name: "un POST sin campos vuelve a la lista", ...statusWith("inactivo", null) },
  { name: "SELLER no puede activar", ...statusWith("inactivo"), role: "SELLER" },
]);

defineCases("deactivateUserAction", deactivateUserAction, [
  { name: "desactivar un usuario activo escribe con su bitacora en la transaccion", ...statusWith("activo") },
  { name: "desactivar un usuario inactivo no escribe", ...statusWith("inactivo") },
  { name: "el usuario no existe", form: { id_usuario: OTHER }, data: noUser },
  { name: "el administrador no puede desactivarse: aviso por la URL", ...statusWith("activo", SELF) },
  { name: "sin id vuelve a la lista sin tocar Prisma", ...statusWith("activo", "") },
  { name: "WORKSHOP_MASTER no puede desactivar", ...statusWith("activo"), role: "WORKSHOP_MASTER" },
]);

defineCases("resetUserPasswordAction", withState(resetUserPasswordAction), [
  { name: "ADMIN restablece la contrasena con su bitacora en la transaccion", ...resetWith() },
  { name: "SELLER no puede restablecer", ...resetWith(), role: "SELLER" },
  { name: "sin id se rechaza sin tocar Prisma", ...resetWith({ id_usuario: "" }) },
  { name: "una contrasena debil se rechaza", ...resetWith({ password: "debil", confirmPassword: "debil" }) },
  { name: "las contrasenas que no coinciden se rechazan", ...resetWith({ confirmPassword: "Clave#Segura2" }) },
  {
    name: "una contrasena de 73 bytes pasa aunque bcrypt ignora el ultimo",
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
    expect(result).toEqual({ estado: { error: "El usuario no existe." } });
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
  it.each([
    { name: "activar", run: activateUserAction, estado: "inactivo", siguiente: "activo" },
    { name: "desactivar", run: deactivateUserAction, estado: "activo", siguiente: "inactivo" },
  ])("$name escribe en la transaccion sin leer antes", async ({ run, estado, siguiente }) => {
    const { calls } = await runCase(run, statusWith(estado));
    const writes = prismaCalls(calls).filter((call) => call.prisma === "usuario.updateMany");

    expect(prismaCalls(calls).map((call) => call.prisma)).not.toContain("usuario.findUnique");
    expect(prismaCalls(calls).map((call) => call.prisma)).not.toContain("usuario.update");
    expect(writes).toEqual([
      {
        prisma: "usuario.updateMany",
        args: { where: { id_usuario: OTHER, estado: { not: siguiente } }, data: { estado: siguiente } },
      },
    ]);
    expect(auditLogs(calls)).toEqual([expect.objectContaining({ enTransaccion: true })]);
  });

  it.each([
    { name: "activar un activo", run: activateUserAction, estado: "activo" },
    { name: "desactivar un inactivo", run: deactivateUserAction, estado: "inactivo" },
  ])("$name no deja bitacora", async ({ run, estado }) => {
    const { calls, result } = await runCase(run, statusWith(estado));

    expect(auditLogs(calls)).toEqual([]);
    expect(result).toBe("redirect:/dashboard/users");
  });
});

describe("restablecer escribe el hash con updateMany en la transaccion", () => {
  const reset = withState(resetUserPasswordAction);

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
    expect(result).toEqual({ estado: { error: "El usuario no existe." } });
  });
});
