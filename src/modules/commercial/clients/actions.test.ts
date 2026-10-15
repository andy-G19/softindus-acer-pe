import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from "@/modules/commercial/clients/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de alta y edicion de clientes (entrega 9),
// escrita antes de que el piloto las lleve al resultado de accion y al panel
// lateral. Cada caso ejecuta la accion real con Prisma, la sesion, la cache,
// la bitacora y los correlativos simulados, y fija en un snapshot, en orden:
// la autorizacion con sus roles, las lecturas, la transaccion con sus
// escrituras y su final, el correlativo, la bitacora (y si va dentro de la
// transaccion), las revalidaciones y el resultado: la redireccion o el estado
// que devuelve al formulario, con su mensaje exacto.
//
// updateClientAction escribe hoy con el cliente global, sin transaccion, y
// registra la bitacora despues: el doble lo permite (writesOutsideTransaction)
// y lo marca, para que el snapshot lo deje a la vista.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
// Entrega 9: cada respuesta lleva un operationId aleatorio; en los snapshots,
// uno fijo.
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
      const next = (mocks.correlatives.get(params.prefijo) ?? 7) + 1;
      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

type FormFields = Record<string, string>;
type ClientAction = (prevState: ClientFormState, formData: FormData) => Promise<ClientFormState>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

const initialState: ClientFormState = { status: "idle" };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  return formData;
}

async function runAction(action: ClientAction, actionCase: ActionCase) {
  mocks.correlatives.clear();

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        return { estado: await action(initialState, formOf(actionCase.form)) };
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

function defineActionSuite(name: string, action: ClientAction, cases: ActionCase[]) {
  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        const { calls, outcome } = await runAction(action, actionCase);

        expectAuthorizesBeforePrisma(calls);
        expect(calls).toMatchSnapshot("llamadas");
        expect(outcome).toMatchSnapshot("resultado");
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const CLIENTE = "CLI00000007";
const OTRO_CLIENTE = "CLI00000003";
const RUC = "20123456789";

const fullForm: FormFields = {
  tipo_cliente: "ferreteria",
  nombre_razon_social: "Ferreteria Andina SAC",
  tipo_documento: "ruc",
  numero_documento: RUC,
  telefono: "987654321",
  correo: "compras@andina.pe",
  direccion: "Av. Industrial 123",
  lugar_origen: "Arequipa",
  observaciones: "Paga al contado",
};

// Los opcionales vacios (y con solo espacios) se guardan como null.
const minimalForm: FormFields = {
  tipo_cliente: "cliente_final",
  nombre_razon_social: "Juan Perez",
  tipo_documento: "",
  numero_documento: "",
  telefono: "  ",
  correo: "",
  direccion: "",
  lugar_origen: "",
  observaciones: "",
};

type Row = Record<string, unknown>;

function whereOf(args: PrismaArgs) {
  return (args?.where ?? {}) as Row;
}

// Busqueda de cliente por id (existencia) o por documento (duplicado).
function clientLookup({ exists = true, documentOwner = null as string | null } = {}): DataOverrides {
  return {
    "cliente.findUnique": (args: PrismaArgs) => {
      const where = whereOf(args);

      if ("numero_documento" in where) {
        return documentOwner ? { id_cliente: documentOwner } : null;
      }

      return exists ? { id_cliente: where.id_cliente } : null;
    },
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`numero_documento`)",
    { code: "P2002", clientVersion: "test" },
  );
}

function failWith(error: Error) {
  return () => {
    throw error;
  };
}

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineActionSuite("createClientAction", createClientAction, [
  { name: "ADMIN crea un cliente con todos los datos", form: fullForm, data: clientLookup() },
  { name: "SELLER tambien puede crear", form: fullForm, data: clientLookup(), role: "SELLER" },
  { name: "WORKSHOP_MASTER no tiene permiso y no toca Prisma", form: fullForm, role: "WORKSHOP_MASTER" },
  { name: "sin documento no busca duplicados y guarda null en los opcionales vacios", form: minimalForm, data: clientLookup() },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    form: { ...fullForm, nombre_razon_social: "A", correo: "no-es-correo", tipo_cliente: "mayorista" },
  },
  { name: "documento de otro cliente: error en el campo, sin transaccion", form: fullForm, data: clientLookup({ documentOwner: OTRO_CLIENTE }) },
  {
    name: "una carrera por el documento (P2002 al crear) revierte y marca el campo",
    form: fullForm,
    data: { ...clientLookup(), "cliente.create": failWith(uniqueViolation()) },
  },
  {
    name: "otro fallo al crear revierte con el mensaje generico",
    form: fullForm,
    data: { ...clientLookup(), "cliente.create": failWith(new Error("conexion perdida")) },
  },
]);

defineActionSuite("updateClientAction", updateClientAction, [
  { name: "ADMIN actualiza un cliente", form: { ...fullForm, id_cliente: CLIENTE }, data: clientLookup() },
  { name: "SELLER tambien puede actualizar", form: { ...fullForm, id_cliente: CLIENTE }, data: clientLookup(), role: "SELLER" },
  {
    name: "WORKSHOP_MASTER no tiene permiso y no toca Prisma",
    form: { ...fullForm, id_cliente: CLIENTE },
    role: "WORKSHOP_MASTER",
  },
  { name: "sin id de cliente", form: fullForm },
  { name: "el cliente no existe", form: { ...fullForm, id_cliente: CLIENTE }, data: clientLookup({ exists: false }) },
  {
    name: "datos invalidos devuelven los errores por campo despues de comprobar el cliente",
    form: { ...fullForm, id_cliente: CLIENTE, nombre_razon_social: "A", correo: "no-es-correo" },
    data: clientLookup(),
  },
  {
    name: "el documento es de otro cliente",
    form: { ...fullForm, id_cliente: CLIENTE },
    data: clientLookup({ documentOwner: OTRO_CLIENTE }),
  },
  {
    name: "conservar su propio documento no es un duplicado",
    form: { ...fullForm, id_cliente: CLIENTE },
    data: clientLookup({ documentOwner: CLIENTE }),
  },
  {
    name: "quitar el documento y vaciar los opcionales guarda null",
    form: { ...minimalForm, id_cliente: CLIENTE },
    data: clientLookup(),
  },
  {
    name: "una carrera por el documento (P2002 al actualizar) marca el campo",
    form: { ...fullForm, id_cliente: CLIENTE },
    data: { ...clientLookup(), "cliente.update": failWith(uniqueViolation()) },
  },
  {
    name: "otro fallo al actualizar devuelve el mensaje generico y no registra bitacora",
    form: { ...fullForm, id_cliente: CLIENTE },
    data: { ...clientLookup(), "cliente.update": failWith(new Error("conexion perdida")) },
  },
]);
