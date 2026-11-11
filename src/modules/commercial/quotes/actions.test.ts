import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { annulQuoteAction, createQuoteAction } from "@/modules/commercial/quotes/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion de crear y anular proforma (C1 de la 11.3a), escrita antes de tocar las
// acciones: hasta aqui no tenian ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion con sus roles, las
// lecturas (y si van fuera de la transaccion), la transaccion con sus correlativos y
// escrituras, la bitacora, su final, las revalidaciones y el resultado: la redireccion o el
// error exacto. Mover una lectura dentro o fuera de la transaccion, o cambiar el saldo o el
// estado que se guardan, cambia el snapshot.
//
// Los montos de estos casos son exactos en binario: el adelanto igual a un total con
// decimales (hallazgo 1 de la 11.3a) tiene su propia prueba.
//
// Desde C4 de la 11.3a crear proforma devuelve un FormActionState (no redirige ni lanza a la
// pagina de error), rechaza un rol sin permiso con un error y reclama la clave de la operacion
// como primera sentencia de la transaccion. Anular sigue redirigiendo hasta C6.

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
// snapshot lo deja a la vista (C3 lo lleva dentro, con la proforma bloqueada).
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

const PEDIDO = "PED00000004";
const PROFORMA = "PRF00000007";

type Role = "ADMIN" | "SELLER" | "WORKSHOP_MASTER";
type ActionCase = {
  name: string;
  form: Record<string, string>;
  data?: DataOverrides;
  role?: Role;
};

function formDataOf(form: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(form)) {
    formData.append(key, value);
  }

  return formData;
}

async function run(action: (formData: FormData) => Promise<unknown>, actionCase: ActionCase, base: DataOverrides) {
  mocks.correlatives.clear();

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        // Crear proforma devuelve su resultado; anular redirige.
        return (await action(formDataOf(actionCase.form))) ?? "termino sin redirigir";
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
// Crear proforma
// ---------------------------------------------------------------------------

/** Pedido de 100.00 + 50.50 = 150.50, sin proforma activa. */
function orderRow(changes: Record<string, unknown> = {}) {
  return {
    id_pedido: PEDIDO,
    id_cliente: "CLI00000002",
    estado: "registrado",
    detalle_pedido: [{ subtotal: D("100.00") }, { subtotal: D("50.50") }],
    proforma: [],
    ...changes,
  };
}

const CLAVE = "5f0c2b7e-8d41-4c3a-9b6e-1a2b3c4d5e6f";

/** El mismo estado inicial que usa el formulario con useActionState. */
const createQuote = (formData: FormData) => createQuoteAction({ status: "idle" }, formData);

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Record<string, unknown> = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: "crear_proforma",
      id_usuario: "USU00000001",
      id_registro_resultado: "PRF00000009",
      ...changes,
    },
  };
}

const quoteForm = (changes: Record<string, string> = {}) => ({
  id_pedido: PEDIDO,
  clave_operacion: CLAVE,
  adelanto_inicial: "",
  metodo_pago_adelanto: "",
  validez_dias: "15",
  observaciones: "",
  ...changes,
});

characterize("createQuoteAction", createQuote, { "pedido.findUnique": orderRow() }, [
  { name: "sin adelanto: nace vigente con el saldo igual al total", form: quoteForm() },
  {
    name: "con adelanto parcial: nace aceptada y registra el adelanto como pago",
    form: quoteForm({ adelanto_inicial: "50.25", metodo_pago_adelanto: "yape", observaciones: "  entrega en obra  " }),
  },
  {
    name: "adelanto igual al total: nace pagada y el pago es de cancelacion",
    form: quoteForm({ adelanto_inicial: "150.50", metodo_pago_adelanto: "transferencia" }),
  },
  { name: "adelanto cero: nace vigente sin pago", form: quoteForm({ adelanto_inicial: "0" }) },
  { name: "sin validez: se guarda nula", form: quoteForm({ validez_dias: "" }) },
  { name: "adelanto sin metodo de pago", form: quoteForm({ adelanto_inicial: "20" }) },
  { name: "sin pedido", form: quoteForm({ id_pedido: "" }) },
  { name: "el pedido no existe", form: quoteForm(), data: { "pedido.findUnique": null } },
  { name: "el pedido no tiene productos", form: quoteForm(), data: { "pedido.findUnique": orderRow({ detalle_pedido: [] }) } },
  {
    name: "el pedido ya tiene una proforma activa",
    form: quoteForm(),
    data: {
      "pedido.findUnique": orderRow({
        proforma: [{ id_proforma: "PRF00000003", numero_proforma: "PF-00000003", estado: "vigente" }],
      }),
    },
  },
  {
    name: "el pedido esta cancelado: se rechaza (D29)",
    form: quoteForm(),
    data: { "pedido.findUnique": orderRow({ estado: "cancelado" }) },
  },
  {
    name: "el adelanto supera el total",
    form: quoteForm({ adelanto_inicial: "150.51", metodo_pago_adelanto: "efectivo" }),
  },
  { name: "sin permiso: el maestro de taller", form: quoteForm(), role: "WORKSHOP_MASTER" },
  { name: "el administrador crea la proforma igual", form: quoteForm(), role: "ADMIN" },
  { name: "sin clave de operacion", form: quoteForm({ clave_operacion: "" }) },
  { name: "clave repetida: responde con la proforma guardada sin escribir", form: quoteForm(), data: storedKey() },
  { name: "clave de otro usuario", form: quoteForm(), data: storedKey({ id_usuario: "USU00000009" }) },
]);

// ---------------------------------------------------------------------------
// Anular proforma
// ---------------------------------------------------------------------------

function quoteRow(changes: Record<string, unknown> = {}) {
  return {
    id_proforma: PROFORMA,
    id_pedido: PEDIDO,
    numero_proforma: "PF-00000007",
    estado: "vigente",
    pago_cliente: [],
    comprobante_venta: [],
    ...changes,
  };
}

const annulForm = (id = PROFORMA) => ({ id_proforma: id });

characterize("annulQuoteAction", annulQuoteAction, { "proforma.findUnique": quoteRow() }, [
  { name: "sin pagos ni comprobantes: la anula", form: annulForm() },
  { name: "el id con espacios se recorta", form: annulForm(` ${PROFORMA} `) },
  { name: "sin id: vuelve al listado", form: annulForm("") },
  { name: "no existe: vuelve al listado", form: annulForm(), data: { "proforma.findUnique": null } },
  {
    name: "ya estaba anulada: vuelve al listado",
    form: annulForm(),
    data: { "proforma.findUnique": quoteRow({ estado: "anulada" }) },
  },
  {
    name: "con pagos: vuelve al detalle sin decir por que",
    form: annulForm(),
    data: { "proforma.findUnique": quoteRow({ pago_cliente: [{ id_pago_cliente: "PCL00000002" }] }) },
  },
  {
    name: "con un comprobante emitido: vuelve al detalle sin decir por que",
    form: annulForm(),
    data: { "proforma.findUnique": quoteRow({ comprobante_venta: [{ id_comprobante: "CMP00000001" }] }) },
  },
  { name: "sin permiso: el maestro de taller", form: annulForm(), role: "WORKSHOP_MASTER" },
]);

// ---------------------------------------------------------------------------
// C2 de la 11.3a (hallazgo 1 y redondeo): montos de la proforma como los guardan las columnas
// ---------------------------------------------------------------------------

// El total se sumaba con number: 100.10 + 200.20 daba 300.29999999999995 y un adelanto de
// 300.30 se rechazaba por «mayor que el monto total». El saldo se restaba con number sobre el
// adelanto sin redondear: con 0.125 sobre 10.00 el saldo era 9.88 y la columna guardaba el
// adelanto como 0.13, asi que adelanto y saldo sumaban 10.01. Un adelanto de 0.004 se
// registraba como un pago de 0.00. Lo que importa es el valor que guardan las columnas
// numeric(12, 2), no el tipo de JavaScript.
describe("C2 de la 11.3a: los montos de la proforma redondeados como las columnas", () => {
  const stored = (value: unknown) => new Prisma.Decimal(String(value)).toFixed(2);
  const withSubtotals = (...subtotals: string[]): DataOverrides => ({
    "pedido.findUnique": orderRow({ detalle_pedido: subtotals.map((subtotal) => ({ subtotal: D(subtotal) })) }),
  });

  function dataOf(calls: Awaited<ReturnType<typeof run>>["calls"], name: string) {
    const call = calls.find((item) => "prisma" in item && item.prisma === name);

    return (call as { args: { data: Record<string, unknown> } } | undefined)?.args.data;
  }

  const create = (form: Record<string, string>, data: DataOverrides) =>
    run(createQuote, { name: "C2", form: quoteForm(form), data }, {});

  it("un adelanto igual a un total con decimales (100.10 + 200.20) la deja pagada con saldo 0.00", async () => {
    const { calls, outcome } = await create(
      { adelanto_inicial: "300.30", metodo_pago_adelanto: "efectivo" },
      withSubtotals("100.10", "200.20"),
    );

    expect(outcome).toMatchObject({ status: "success" });

    const proforma = dataOf(calls, "proforma.create");
    const pago = dataOf(calls, "pago_cliente.create");

    expect([stored(proforma?.monto_total), stored(proforma?.saldo), proforma?.estado]).toEqual(["300.30", "0.00", "pagada"]);
    expect([stored(pago?.monto_pagado), stored(pago?.saldo_actual), pago?.tipo_pago]).toEqual(["300.30", "0.00", "cancelacion"]);
  });

  it("un adelanto de 0.125 sobre 10.00: adelanto y saldo suman el total con lo que guardan las columnas", async () => {
    const { calls } = await create({ adelanto_inicial: "0.125", metodo_pago_adelanto: "yape" }, withSubtotals("10.00"));

    const proforma = dataOf(calls, "proforma.create");
    const pago = dataOf(calls, "pago_cliente.create");

    expect([stored(proforma?.adelanto_inicial), stored(proforma?.saldo)]).toEqual(["0.13", "9.87"]);
    expect([stored(pago?.monto_pagado), stored(pago?.saldo_actual)]).toEqual(["0.13", "9.87"]);
  });

  it("un adelanto que se guardaria como 0.00 se rechaza sin escribir", async () => {
    const { calls, outcome } = await create({ adelanto_inicial: "0.004", metodo_pago_adelanto: "yape" }, withSubtotals("10.00"));

    expect(outcome).toMatchObject({
      status: "error",
      error: "Revisa los datos de la proforma.",
      fieldErrors: { adelanto_inicial: ["El adelanto debe ser cero o de al menos S/ 0.01."] },
    });
    expect(dataOf(calls, "proforma.create")).toBeUndefined();
    expect(dataOf(calls, "pago_cliente.create")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// C3 de la 11.3a (hallazgos 3 y 4, D26 y D29): decidir con la fila bloqueada
// ---------------------------------------------------------------------------

// Crear proforma leia el pedido y su proforma activa fuera de la transaccion: dos altas
// simultaneas podian dejar dos proformas activas, y cancelar el pedido a la vez dejaba un pedido
// cancelado con proforma. Tampoco miraba el estado del pedido: un formulario abierto antes de
// cancelarlo creaba la proforma. Anular leia pagos y comprobantes fuera de la transaccion y
// escribia la anulacion y su bitacora con el cliente global: un pago simultaneo podia quedar en
// una proforma anulada. Ahora el pedido (al crear) y la proforma (al anular) se bloquean dentro
// de la transaccion antes de leer lo que decide. El rechazo visible no cambia todavia (C4 y C6).
describe("C3 de la 11.3a: proformas que deciden con la fila bloqueada", () => {
  type Calls = Awaited<ReturnType<typeof run>>["calls"];

  const reads = (name: string) => (call: { prisma: string }) => call.prisma === name;
  const writes = (calls: Calls) =>
    calls.filter((call) => "prisma" in call && /\.(create|update|updateMany)$/.test(call.prisma));

  it("crear bloquea el pedido antes de leerlo, dentro de la transaccion", async () => {
    const { calls, outcome } = await run(createQuote, { name: "C3", form: quoteForm() }, { "pedido.findUnique": orderRow() });

    expect(outcome).toMatchObject({ status: "success" });
    expectRowLockedBefore(calls, { table: "pedido", id: PEDIDO, reads: reads("pedido.findUnique") });
  });

  it.each(["cancelado", "anulado", "entregado"])("crear rechaza un pedido %s sin escribir (D29)", async (estado) => {
    const { calls, outcome } = await run(
      createQuote,
      { name: "C3", form: quoteForm() },
      { "pedido.findUnique": orderRow({ estado }) },
    );
    const message = "Solo se puede generar la proforma de un pedido registrado o aprobado.";

    expect(outcome).toMatchObject({ status: "error", error: message, fieldErrors: { id_pedido: [message] } });
    expect(writes(calls)).toEqual([]);
  });

  it("crear acepta un pedido aprobado", async () => {
    const { outcome } = await run(
      createQuote,
      { name: "C3", form: quoteForm() },
      { "pedido.findUnique": orderRow({ estado: "aprobado" }) },
    );

    expect(outcome).toMatchObject({ status: "success" });
  });

  it("anular bloquea la proforma antes de leerla y escribe dentro de la transaccion", async () => {
    const { calls, outcome } = await run(annulQuoteAction, { name: "C3", form: annulForm() }, { "proforma.findUnique": quoteRow() });

    expect(outcome).toBe("redirect:/dashboard/commercial/quotes?toast=quote-annulled");
    expectRowLockedBefore(calls, { table: "proforma", id: PROFORMA, reads: reads("proforma.findUnique") });
    expect(writes(calls).map((call) => ("fueraDeTransaccion" in call ? "fuera" : "dentro"))).toEqual(["dentro"]);
    expect(calls.find((call) => "effect" in call && call.effect === "registerAuditLog")).toMatchObject({
      args: { enTransaccion: true },
    });
  });

  it("anular con pagos sigue volviendo al detalle, ahora sin escribir y con la fila bloqueada", async () => {
    const { calls, outcome } = await run(
      annulQuoteAction,
      { name: "C3", form: annulForm() },
      { "proforma.findUnique": quoteRow({ pago_cliente: [{ id_pago_cliente: "PCL00000002" }] }) },
    );

    expect(outcome).toBe(`redirect:/dashboard/commercial/quotes/${PROFORMA}`);
    expectRowLockedBefore(calls, { table: "proforma", id: PROFORMA, reads: reads("proforma.findUnique") });
    expect(writes(calls)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C4 de la 11.3a (D27): crear proforma con resultado e idempotencia
// ---------------------------------------------------------------------------

// La clave se reclama como primera sentencia de la transaccion, antes del bloqueo del pedido y
// de los correlativos: un reenvio responde con la proforma ya guardada y no crea otra ni
// registra el adelanto dos veces. Un rechazo despues del reclamo lanza dentro de la transaccion,
// asi la clave se libera y el envio corregido se guarda.
describe("C4 de la 11.3a: crear proforma con resultado e idempotencia", () => {
  type Calls = Awaited<ReturnType<typeof run>>["calls"];

  const index = (calls: Calls, name: string) => calls.findIndex((call) => "prisma" in call && call.prisma === name);
  const create = (actionCase: Omit<ActionCase, "name">) =>
    run(createQuote, { name: "C4", ...actionCase }, { "pedido.findUnique": orderRow() });

  it("reclama la clave antes de bloquear el pedido y la completa con la proforma", async () => {
    const { calls, outcome } = await create({
      form: quoteForm({ adelanto_inicial: "50.25", metodo_pago_adelanto: "yape" }),
    });

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_proforma: "PRF00000001", clave_operacion: CLAVE },
    });
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeGreaterThan(-1);
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeLessThan(index(calls, "$queryRaw"));
    expect(index(calls, "pago_cliente.create")).toBeLessThan(index(calls, "operacion_idempotente.updateMany"));
  });

  it("una clave repetida no bloquea, no crea la proforma ni registra el adelanto", async () => {
    const { calls, outcome } = await create({
      form: quoteForm({ adelanto_inicial: "50.25", metodo_pago_adelanto: "yape" }),
      data: storedKey(),
    });

    expect(outcome).toMatchObject({ status: "success", data: { id_proforma: "PRF00000009", clave_operacion: CLAVE } });
    expect(index(calls, "$queryRaw")).toBe(-1);
    expect(index(calls, "proforma.create")).toBe(-1);
    expect(index(calls, "pago_cliente.create")).toBe(-1);
  });

  it("un rechazo dentro de la transaccion va a su campo y deshace el reclamo de la clave", async () => {
    const { calls, outcome } = await create({
      form: quoteForm({ adelanto_inicial: "150.51", metodo_pago_adelanto: "efectivo" }),
    });
    const message = "El adelanto inicial no puede ser mayor que el monto total.";

    expect(outcome).toMatchObject({ status: "error", error: message, fieldErrors: { adelanto_inicial: [message] } });
    expect(calls.some((call) => "effect" in call && call.effect === "prisma.$transaction:rollback")).toBe(true);
  });

  it("sin permiso responde en el formulario y no consulta nada", async () => {
    const { calls, outcome } = await create({ form: quoteForm(), role: "WORKSHOP_MASTER" });

    expect(outcome).toMatchObject({ status: "error", error: "No tienes permisos para crear proformas." });
    expect(calls.some((call) => "prisma" in call)).toBe(false);
  });

  it("tras un error devuelve lo enviado para volver a mostrarlo", async () => {
    const { outcome } = await create({
      form: quoteForm({ adelanto_inicial: "20", metodo_pago_adelanto: "", observaciones: "  obra  " }),
    });

    expect(outcome).toMatchObject({
      status: "error",
      values: { id_pedido: PEDIDO, adelanto_inicial: "20", metodo_pago_adelanto: "", validez_dias: "15", observaciones: "  obra  " },
      fieldErrors: { metodo_pago_adelanto: ["Selecciona el método de pago del adelanto."] },
    });
  });
});
