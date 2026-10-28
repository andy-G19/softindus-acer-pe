import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createOrderAction,
  updateOrderAction,
  type OrderFormState,
} from "@/modules/commercial/orders/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion del alta y la edicion de pedidos (entrega 10.4c), escrita
// antes de llevar el formulario a FormActionState y de corregir sus importes,
// sus clientes y productos inactivos y sus mensajes. Fija en orden la
// autorizacion con sus roles, las lecturas, la transaccion con sus escrituras
// y su final, los correlativos, la bitacora (y si va dentro de la
// transaccion), las revalidaciones y la redireccion o el error.
//
// Hoy autorizan con requireRole: sin permiso redirigen (el doble lanza
// AuthRejected) en lugar de devolver un error, y con exito redirigen con
// ?toast=. Lo que fijan los casos y se corrige despues, cada cosa en su
// commit:
// - los importes se calculan en coma flotante sin redondear, y la base
//   redondea cada columna por su cuenta (hallazgo 6 de la 10.4a);
// - no comprueban que el cliente y los productos existan ni esten activos: un
//   id inexistente rompe en la clave foranea (hallazgo 5 de la 10.4a);
// - un campo que falta o un numero que no lo es dan el mensaje de Zod en
//   ingles, una cantidad fuera de la columna llega a la base y una fecha que
//   no existe da el mensaje de la fecha anterior.
// La edicion decide fuera de la transaccion y sin bloquear la fila
// (hallazgo 7 de la 10.4a, entrega 11): no se corrige aqui.

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
    const last = mocks.correlatives.get(prefijo) ?? 9;
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

type FormFields = Record<string, string | string[]>;
type OrderAction = (prevState: OrderFormState, formData: FormData) => Promise<OrderFormState>;
type ActionCase = {
  name: string;
  form: FormFields;
  data?: DataOverrides;
  role?: Role;
  /** Instante del caso; si falta, el del arnes (15/07/2026, 10:00 de Lima). */
  now?: string;
};

const initialState: OrderFormState = { error: "" };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      formData.append(key, item);
    }
  }

  return formData;
}

function defineOrderSuite(name: string, action: OrderAction, cases: ActionCase[]) {
  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        mocks.correlatives.clear();

        const { calls, result } = await characterizeHandler(
          async () => {
            if (actionCase.now) {
              vi.setSystemTime(new Date(actionCase.now));
            }

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

const CLIENTE = "CLI00000003";
const PEDIDO = "PED00000020";
const PRODUCTO_A = "PRO00000001";
const PRODUCTO_B = "PRO00000002";

// Una linea por producto: los campos repetidos van en el mismo orden.
function lines(...items: Array<[string, string, string, string?]>): FormFields {
  return {
    id_producto: items.map(([id]) => id),
    cantidad: items.map(([, cantidad]) => cantidad),
    precio_unitario: items.map(([, , precio]) => precio),
    observacion_detalle: items.map(([, , , observacion]) => observacion ?? ""),
  };
}

const twoLines = lines([PRODUCTO_A, "2", "150", "Pintado negro"], [PRODUCTO_B, "1", "80.5"]);

const orderForm: FormFields = {
  id_cliente: CLIENTE,
  fecha_entrega_estimada: "2026-07-20",
  observaciones: "Entrega en obra.",
  ...twoLines,
};

// Pedido que lee la edicion: registrado, del 10/07/2026, sin proforma,
// comprobante ni orden de trabajo, salvo lo que el caso cambie.
function orderRow(overrides: Record<string, unknown> = {}): DataOverrides {
  return {
    "pedido.findUnique": {
      id_pedido: PEDIDO,
      id_cliente: CLIENTE,
      estado: "registrado",
      fecha_pedido: new Date("2026-07-10T00:00:00.000Z"),
      fecha_entrega_estimada: null,
      monto_estimado: new Prisma.Decimal("380.50"),
      observaciones: null,
      proforma: [],
      comprobante_venta: [],
      detalle_pedido: [{ id_detalle_pedido: "DPE00000040", id_producto: PRODUCTO_A, orden_trabajo: [] }],
      ...overrides,
    },
  };
}

const editForm: FormFields = { ...orderForm, id_pedido: PEDIDO };

function foreignKeyViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Foreign key constraint violated on the constraint: `fk_detalle_pedido_producto`",
    { code: "P2003", clientVersion: "test" },
  );
}

function failWith(error: Error) {
  return () => {
    throw error;
  };
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

defineOrderSuite("createOrderAction", createOrderAction, [
  { name: "ADMIN crea un pedido de dos lineas", form: orderForm },
  { name: "SELLER crea un pedido", form: orderForm, role: "SELLER" },
  { name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma", form: orderForm, role: "WORKSHOP_MASTER" },
  {
    name: "importes con decimales: cada subtotal y el monto sin redondear",
    form: { ...orderForm, ...lines([PRODUCTO_A, "1.25", "10.25"], [PRODUCTO_B, "1.25", "10.25"]) },
  },
  {
    name: "importes en coma flotante: 3 x 0.1",
    form: { ...orderForm, ...lines([PRODUCTO_A, "3", "0.1"]) },
  },
  {
    name: "una cantidad de tres decimales se multiplica sin redondear",
    form: { ...orderForm, ...lines([PRODUCTO_A, "1.005", "10"]) },
  },
  { name: "sin cliente elegido", form: { ...orderForm, id_cliente: "" } },
  {
    name: "sin el campo cliente da el mensaje de Zod en ingles",
    form: Object.fromEntries(Object.entries(orderForm).filter(([key]) => key !== "id_cliente")),
  },
  { name: "sin lineas", form: { ...orderForm, ...lines() } },
  {
    name: "una linea sin producto se descarta",
    form: { ...orderForm, ...lines([PRODUCTO_A, "2", "150"], ["", "5", "10"]) },
  },
  { name: "cantidad cero", form: { ...orderForm, ...lines([PRODUCTO_A, "0", "150"]) } },
  {
    name: "cantidad que no es un numero da el mensaje de Zod en ingles",
    form: { ...orderForm, ...lines([PRODUCTO_A, "abc", "150"]) },
  },
  { name: "precio negativo", form: { ...orderForm, ...lines([PRODUCTO_A, "2", "-1"]) } },
  {
    name: "precio infinito da el mensaje de Zod en ingles",
    form: { ...orderForm, ...lines([PRODUCTO_A, "2", "1e400"]) },
  },
  {
    name: "una cantidad que no cabe en la columna llega a la base",
    form: { ...orderForm, ...lines([PRODUCTO_A, "1e12", "10"]) },
  },
  { name: "producto repetido", form: { ...orderForm, ...lines([PRODUCTO_A, "2", "150"], [PRODUCTO_A, "1", "80"]) } },
  {
    name: "observaciones de mas de 500 caracteres",
    form: { ...orderForm, observaciones: "x".repeat(501) },
  },
  {
    name: "observaciones con espacios se guardan como null",
    form: { ...orderForm, observaciones: "   ", ...lines([PRODUCTO_A, "2", "150", "   "]) },
  },
  { name: "sin fecha de entrega", form: { ...orderForm, fecha_entrega_estimada: "" } },
  { name: "entrega hoy", form: { ...orderForm, fecha_entrega_estimada: "2026-07-15" } },
  { name: "entrega anterior a hoy", form: { ...orderForm, fecha_entrega_estimada: "2026-07-14" } },
  {
    name: "una fecha que no existe da el mensaje de la fecha anterior",
    form: { ...orderForm, fecha_entrega_estimada: "2026-02-30" },
  },
  {
    name: "despues de las 19:00 de Lima, hoy como entrega es anterior al pedido",
    form: { ...orderForm, fecha_entrega_estimada: "2026-07-15" },
    now: "2026-07-16T01:00:00.000Z",
  },
  {
    name: "un producto inexistente rompe en la clave foranea",
    form: orderForm,
    data: { "detalle_pedido.createMany": failWith(foreignKeyViolation()) },
  },
]);

// ---------------------------------------------------------------------------
// Edicion
// ---------------------------------------------------------------------------

defineOrderSuite("updateOrderAction", updateOrderAction, [
  { name: "ADMIN edita un pedido registrado", form: editForm, data: orderRow() },
  { name: "SELLER edita un pedido", form: editForm, data: orderRow(), role: "SELLER" },
  { name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma", form: editForm, role: "WORKSHOP_MASTER" },
  { name: "sin id de pedido", form: orderForm },
  { name: "el pedido no existe", form: editForm, data: { "pedido.findUnique": null } },
  { name: "pedido cancelado", form: editForm, data: orderRow({ estado: "cancelado" }) },
  { name: "pedido anulado", form: editForm, data: orderRow({ estado: "anulado" }) },
  {
    name: "pedido con proforma",
    form: editForm,
    data: orderRow({ proforma: [{ id_proforma: "PRF00000001" }] }),
  },
  {
    name: "pedido con comprobante",
    form: editForm,
    data: orderRow({ comprobante_venta: [{ id_comprobante: "CVE00000001" }] }),
  },
  {
    name: "pedido con orden de trabajo",
    form: editForm,
    data: orderRow({
      detalle_pedido: [
        {
          id_detalle_pedido: "DPE00000040",
          id_producto: PRODUCTO_A,
          orden_trabajo: [{ id_orden_trabajo: "OTR00000001" }],
        },
      ],
    }),
  },
  {
    name: "un error de validacion llega despues de leer el pedido",
    form: { ...editForm, id_cliente: "" },
    data: orderRow(),
  },
  {
    name: "entrega igual a la fecha del pedido",
    form: { ...editForm, fecha_entrega_estimada: "2026-07-10" },
    data: orderRow(),
  },
  {
    name: "entrega anterior a la fecha del pedido",
    form: { ...editForm, fecha_entrega_estimada: "2026-07-09" },
    data: orderRow(),
  },
  {
    name: "producto repetido",
    form: { ...editForm, ...lines([PRODUCTO_A, "2", "150"], [PRODUCTO_A, "1", "80"]) },
    data: orderRow(),
  },
  {
    name: "importes con decimales: cada subtotal y el monto sin redondear",
    form: { ...editForm, ...lines([PRODUCTO_A, "1.25", "10.25"], [PRODUCTO_B, "1.25", "10.25"]) },
    data: orderRow(),
  },
  {
    name: "un producto inexistente rompe en la clave foranea despues de borrar el detalle",
    form: editForm,
    data: { ...orderRow(), "detalle_pedido.createMany": failWith(foreignKeyViolation()) },
  },
]);
