import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { annulQuoteAction, createQuoteAction } from "@/modules/commercial/quotes/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
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

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
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
        await action(formDataOf(actionCase.form));

        return "termino sin redirigir";
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

const quoteForm = (changes: Record<string, string> = {}) => ({
  id_pedido: PEDIDO,
  adelanto_inicial: "",
  metodo_pago_adelanto: "",
  validez_dias: "15",
  observaciones: "",
  ...changes,
});

characterize("createQuoteAction", createQuoteAction, { "pedido.findUnique": orderRow() }, [
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
    name: "el pedido esta cancelado: hoy se acepta (hallazgo 3 de la 11.3a)",
    form: quoteForm(),
    data: { "pedido.findUnique": orderRow({ estado: "cancelado" }) },
  },
  {
    name: "el adelanto supera el total",
    form: quoteForm({ adelanto_inicial: "150.51", metodo_pago_adelanto: "efectivo" }),
  },
  { name: "sin permiso: el maestro de taller", form: quoteForm(), role: "WORKSHOP_MASTER" },
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
