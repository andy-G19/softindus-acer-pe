import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { annulReceiptAction, createReceiptAction } from "@/modules/commercial/receipts/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion de emitir y anular comprobante (C2 de la 11.3b), escrita antes de tocar las
// acciones: hasta aqui no tenian ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion con sus roles, las
// lecturas (y si van fuera de la transaccion), la transaccion con su correlativo y su escritura,
// la bitacora, su final, las revalidaciones y el resultado: la redireccion o el error exacto.
//
// Los montos de estos casos son exactos en binario: el monto con decimales y el que se
// guardaria como 0.00 (hallazgo 3 del plan de la 11.3b) tienen su propia prueba.
//
// Desde C6 de la 11.3b emitir devuelve un FormActionState (no redirige ni lanza a la pagina de
// error), rechaza un rol sin permiso con un error y reclama la clave de la operacion como
// primera sentencia de la transaccion. Anular sigue redirigiendo hasta C7.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
// Cada respuesta lleva un operationId aleatorio: se fija para que el snapshot sea estable.
vi.mock("@/lib/action-result", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/action-result")>()),
  newOperationId: () => "operacion-de-prueba",
}));
// Anular escribe con el cliente global, fuera de una transaccion: el doble lo permite y el
// snapshot lo deja a la vista.
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
    getNextCorrelativeId: async (_tx: unknown, params: { codigoEntidad: string; prefijo: string }) => {
      recordEffect("getNextCorrelativeId", params);

      const next = (mocks.correlatives.get(params.prefijo) ?? 0) + 1;

      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

expect.addSnapshotSerializer(decimalSnapshotSerializer);

const D = (value: string) => new Prisma.Decimal(value);

const PROFORMA = "PRF00000007";
const COMPROBANTE = "CMP00000003";

type ActionCase = {
  name: string;
  form: Record<string, string>;
  data?: DataOverrides;
  role?: "ADMIN" | "SELLER" | "WORKSHOP_MASTER";
};

async function run(action: (formData: FormData) => Promise<unknown>, actionCase: ActionCase, base: DataOverrides) {
  mocks.correlatives.clear();

  const formData = new FormData();

  for (const [key, value] of Object.entries(actionCase.form)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        return (await action(formData)) ?? "termino sin redirigir";
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { ...base, ...actionCase.data },
    { role: actionCase.role ?? "SELLER" },
  );

  return { calls, outcome: result };
}

function characterize(
  title: string,
  action: (formData: FormData) => Promise<unknown>,
  base: DataOverrides,
  actionCases: ActionCase[],
) {
  describe(title, () => {
    for (const actionCase of actionCases) {
      it(actionCase.name, async () => {
        const { calls, outcome } = await run(action, actionCase, base);

        expectAuthorizesBeforePrisma(calls);
        expect(calls).toMatchSnapshot("llamadas");
        expect(outcome).toMatchSnapshot("resultado");
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Emitir comprobante
// ---------------------------------------------------------------------------

/** Proforma aceptada de 150.50, sin comprobante emitido. */
function quoteRow(changes: Record<string, unknown> = {}) {
  return {
    id_proforma: PROFORMA,
    id_pedido: "PED00000004",
    monto_total: D("150.50"),
    estado: "aceptada",
    comprobante_venta: [],
    ...changes,
  };
}

const CLAVE = "3c9e1a7b-5d2f-4b8a-9c6e-0f1a2b3c4d5e";

/** El mismo estado inicial que usa el formulario con useActionState. */
const createReceipt = (formData: FormData) => createReceiptAction({ status: "idle" }, formData);

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Record<string, unknown> = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: "emitir_comprobante",
      id_usuario: "USU00000001",
      id_registro_resultado: "CMP00000009",
      ...changes,
    },
  };
}

const receiptForm = (changes: Record<string, string> = {}) => ({
  id_proforma: PROFORMA,
  clave_operacion: CLAVE,
  tipo_comprobante: "boleta",
  numero_comprobante: "B001-000123",
  monto_total: "150.50",
  observaciones: "",
  ...changes,
});

const free: DataOverrides = { "proforma.findUnique": quoteRow(), "comprobante_venta.findUnique": null };

characterize("createReceiptAction", createReceipt, free, [
  { name: "boleta por el total de la proforma", form: receiptForm() },
  {
    name: "factura por un monto menor, con observaciones y espacios en el numero",
    form: receiptForm({ tipo_comprobante: "factura", numero_comprobante: "  F001-000045  ", monto_total: "100.25", observaciones: "  entrega parcial  " }),
  },
  { name: "la proforma no existe", form: receiptForm(), data: { "proforma.findUnique": null } },
  { name: "proforma anulada", form: receiptForm(), data: { "proforma.findUnique": quoteRow({ estado: "anulada" }) } },
  {
    name: "la proforma ya tiene un comprobante emitido",
    form: receiptForm(),
    data: {
      "proforma.findUnique": quoteRow({
        comprobante_venta: [{ id_comprobante: "CMP00000001", numero_comprobante: "B001-000100" }],
      }),
    },
  },
  { name: "el monto supera el total de la proforma", form: receiptForm({ monto_total: "150.75" }) },
  {
    name: "el numero ya existe en otro comprobante",
    form: receiptForm(),
    data: { "comprobante_venta.findUnique": { id_comprobante: "CMP00000002" } },
  },
  { name: "sin numero", form: receiptForm({ numero_comprobante: "   " }) },
  { name: "tipo invalido", form: receiptForm({ tipo_comprobante: "ticket" }) },
  { name: "monto cero", form: receiptForm({ monto_total: "0" }) },
  { name: "sin permiso: el maestro de taller", form: receiptForm(), role: "WORKSHOP_MASTER" },
  { name: "el administrador lo emite igual", form: receiptForm(), role: "ADMIN" },
  { name: "sin clave de operacion", form: receiptForm({ clave_operacion: "" }) },
  { name: "clave repetida: responde con el comprobante emitido sin escribir", form: receiptForm(), data: storedKey() },
  { name: "clave de otro usuario", form: receiptForm(), data: storedKey({ id_usuario: "USU00000009" }) },
]);

// ---------------------------------------------------------------------------
// Anular comprobante
// ---------------------------------------------------------------------------

function receiptRow(changes: Record<string, unknown> = {}) {
  return {
    id_comprobante: COMPROBANTE,
    id_pedido: "PED00000004",
    id_proforma: PROFORMA,
    tipo_comprobante: "boleta",
    numero_comprobante: "B001-000123",
    monto_total: D("150.50"),
    estado: "emitido",
    ...changes,
  };
}

const annulForm = (id = COMPROBANTE) => ({ id_comprobante: id });

characterize("annulReceiptAction", annulReceiptAction, { "comprobante_venta.findUnique": receiptRow() }, [
  { name: "emitido: lo anula", form: annulForm() },
  { name: "el id con espacios se recorta", form: annulForm(` ${COMPROBANTE} `) },
  { name: "sin id: vuelve al listado", form: annulForm("") },
  { name: "no existe: vuelve al listado", form: annulForm(), data: { "comprobante_venta.findUnique": null } },
  {
    name: "ya estaba anulado: vuelve al listado",
    form: annulForm(),
    data: { "comprobante_venta.findUnique": receiptRow({ estado: "anulado" }) },
  },
  { name: "sin permiso: el maestro de taller", form: annulForm(), role: "WORKSHOP_MASTER" },
]);

// ---------------------------------------------------------------------------
// C5 de la 11.3b (hallazgos 3 y 4 del plan): monto en centimos y la proforma bloqueada
// ---------------------------------------------------------------------------

// El monto se comparaba con el total de la proforma con number y se guardaba sin redondear: uno
// de 0.004 se guardaba como 0.00, y uno de 150.504 sobre un total de 150.50 se rechazaba aunque
// la columna lo guardaria igual al total. La proforma, el comprobante emitido y el numero se
// leian fuera de la transaccion: dos comprobantes simultaneos para la misma proforma podian
// pasar los dos. Ahora la proforma se bloquea y todo se decide dentro de la transaccion.
describe("C5 de la 11.3b: el comprobante en centimos y con la proforma bloqueada", () => {
  const stored = (value: unknown) => new Prisma.Decimal(String(value)).toFixed(2);
  const create = (form: Record<string, string>) => run(createReceipt, { name: "C5", form: receiptForm(form) }, free);

  function dataOf(calls: Awaited<ReturnType<typeof run>>["calls"], name: string) {
    const call = calls.find((item) => "prisma" in item && item.prisma === name);

    return (call as { args: { data: Record<string, unknown> } } | undefined)?.args.data;
  }

  it("un monto que se guardaria como 0.00 se rechaza", async () => {
    const { calls, outcome } = await create({ monto_total: "0.004" });

    expect(outcome).toMatchObject({
      status: "error",
      error: "Revisa los datos del comprobante.",
      fieldErrors: { monto_total: ["El monto total debe ser mayor que cero."] },
    });
    expect(dataOf(calls, "comprobante_venta.create")).toBeUndefined();
  });

  it("150.504 sobre un total de 150.50 se acepta: la columna lo guarda como 150.50", async () => {
    const { calls, outcome } = await create({ monto_total: "150.504" });

    expect(outcome).toMatchObject({ status: "success" });
    expect(stored(dataOf(calls, "comprobante_venta.create")?.monto_total)).toBe("150.50");
  });

  it("150.505 sobre un total de 150.50 se rechaza: la columna lo guardaria como 150.51", async () => {
    const { outcome } = await create({ monto_total: "150.505" });

    const message = "El comprobante no puede superar el monto total de la proforma.";

    expect(outcome).toMatchObject({ status: "error", error: message, fieldErrors: { monto_total: [message] } });
  });

  it.each([
    ["emitido", {}],
    ["rechazado por el numero repetido", { "comprobante_venta.findUnique": { id_comprobante: "CMP00000002" } }],
  ])("%s: bloquea la proforma antes de leer lo que decide", async (_name, data) => {
    const { calls } = await run(createReceipt, { name: "C5", form: receiptForm(), data }, free);

    expectRowLockedBefore(calls, {
      table: "proforma",
      id: PROFORMA,
      reads: (call) => ["proforma.findUnique", "comprobante_venta.findUnique"].includes(call.prisma),
    });
  });
});

// ---------------------------------------------------------------------------
// C6 de la 11.3b (D32, hallazgo 6 de la 11.3a): el comprobante con resultado e idempotencia
// ---------------------------------------------------------------------------

// La clave se reclama como primera sentencia de la transaccion, antes del bloqueo de la proforma
// y del correlativo: un reenvio responde con el comprobante ya emitido. Un rechazo despues del
// reclamo lanza dentro de la transaccion, asi la clave se libera. Un numero repetido va a su
// campo, tambien cuando otro comprobante lo toma entre la busqueda y el alta (P2002).
describe("C6 de la 11.3b: el comprobante con resultado e idempotencia", () => {
  type Calls = Awaited<ReturnType<typeof run>>["calls"];

  const index = (calls: Calls, name: string) => calls.findIndex((call) => "prisma" in call && call.prisma === name);
  const emit = (data: DataOverrides = {}, form = receiptForm(), role?: ActionCase["role"]) =>
    run(createReceipt, { name: "C6", form, data, role }, free);
  const NUMBER_TAKEN = "Ya existe un comprobante con ese número.";

  it("reclama la clave antes de bloquear la proforma y la completa con el comprobante", async () => {
    const { calls, outcome } = await emit();

    expect(outcome).toMatchObject({ status: "success", data: { id_comprobante: "CMP00000001", clave_operacion: CLAVE } });
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeGreaterThan(-1);
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeLessThan(index(calls, "$queryRaw"));
    expect(index(calls, "comprobante_venta.create")).toBeLessThan(index(calls, "operacion_idempotente.updateMany"));
  });

  it("una clave repetida no bloquea ni emite otro comprobante", async () => {
    const { calls, outcome } = await emit(storedKey());

    expect(outcome).toMatchObject({ status: "success", data: { id_comprobante: "CMP00000009" } });
    expect(index(calls, "$queryRaw")).toBe(-1);
    expect(index(calls, "comprobante_venta.create")).toBe(-1);
  });

  it("un numero repetido va a su campo y deshace el reclamo", async () => {
    const { calls, outcome } = await emit({ "comprobante_venta.findUnique": { id_comprobante: "CMP00000002" } });

    expect(outcome).toMatchObject({ status: "error", error: NUMBER_TAKEN, fieldErrors: { numero_comprobante: [NUMBER_TAKEN] } });
    expect(calls.some((call) => "effect" in call && call.effect === "prisma.$transaction:rollback")).toBe(true);
  });

  it("un numero tomado en carrera (P2002 del indice unico) tambien va a su campo", async () => {
    const taken = new Prisma.PrismaClientKnownRequestError("Unique constraint failed on numero_comprobante", {
      code: "P2002",
      clientVersion: "7",
    });
    const { outcome } = await emit({
      "comprobante_venta.create": () => {
        throw taken;
      },
    });

    expect(outcome).toMatchObject({ status: "error", error: NUMBER_TAKEN, fieldErrors: { numero_comprobante: [NUMBER_TAKEN] } });
  });

  it.each([
    ["la proforma no existe", { "proforma.findUnique": null }, "La proforma seleccionada no existe."],
    ["anulada", { "proforma.findUnique": quoteRow({ estado: "anulada" }) }, "No se puede emitir comprobante para una proforma anulada."],
  ])("%s: el error queda en la seccion, sin campo", async (_name, data, message) => {
    const { outcome } = await emit(data as DataOverrides);

    expect(outcome).toMatchObject({ status: "error", error: message, fieldErrors: undefined });
  });

  it("sin permiso responde en la seccion y no consulta nada", async () => {
    const { calls, outcome } = await emit({}, receiptForm(), "WORKSHOP_MASTER");

    expect(outcome).toMatchObject({ status: "error", error: "No tienes permisos para emitir comprobantes." });
    expect(calls.some((call) => "prisma" in call)).toBe(false);
  });

  it("tras un error devuelve lo enviado para volver a mostrarlo", async () => {
    const { outcome } = await emit(
      { "comprobante_venta.findUnique": { id_comprobante: "CMP00000002" } },
      receiptForm({ tipo_comprobante: "factura", numero_comprobante: "F001-9", monto_total: "100", observaciones: "  obra  " }),
    );

    expect(outcome).toMatchObject({
      values: { tipo_comprobante: "factura", numero_comprobante: "F001-9", monto_total: "100", observaciones: "  obra  " },
    });
  });
});
