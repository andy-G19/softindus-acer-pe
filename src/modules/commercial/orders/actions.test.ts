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
  type PrismaArgs,
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
// - los importes se calculaban en coma flotante sin redondear, y la base
//   redondeaba cada columna por su cuenta (hallazgo 6 de la 10.4a; corregido
//   en C2 con src/lib/order-amounts.ts);
// - no comprobaban que el cliente y los productos existieran ni estuvieran
//   activos: un id inexistente rompia en la clave foranea, y la edicion no
//   distinguia el cliente o los productos que el pedido ya tenia (hallazgo 5
//   de la 10.4a; corregido en C3: los casos de la clave foranea simulan ahora
//   un producto borrado entre la comprobacion y la escritura);
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
          { ...CATALOG, ...actionCase.data },
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
const CLIENTE_INACTIVO = "CLI00000004";
const PRODUCTO_INACTIVO = "PRO00000003";

// Clientes y productos de la base en todos los casos (C3): los de arriba,
// activos o inactivos; cualquier otro id no existe.
const CLIENTES: Record<string, boolean> = { [CLIENTE]: true, [CLIENTE_INACTIVO]: false };
const PRODUCTOS: Record<string, boolean> = { [PRODUCTO_A]: true, [PRODUCTO_B]: true, [PRODUCTO_INACTIVO]: false };

const CATALOG: DataOverrides = {
  "cliente.findUnique": (args: PrismaArgs) => {
    const id = String((args?.where as Record<string, unknown>)?.id_cliente);

    return Object.hasOwn(CLIENTES, id) ? { id_cliente: id, estado: CLIENTES[id] } : null;
  },
  "producto.findMany": (args: PrismaArgs) => {
    const filter = (args?.where as { id_producto?: { in?: string[] } })?.id_producto?.in ?? [];

    return filter
      .filter((id) => Object.hasOwn(PRODUCTOS, id))
      .map((id) => ({ id_producto: id, estado: PRODUCTOS[id] }));
  },
};

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
// Importes con la regla de la base (C2, hallazgo 6 de la 10.4a)
// ---------------------------------------------------------------------------

// Lo que escribe la accion en el pedido y en su detalle: la cantidad, el
// precio y el subtotal redondeados como sus columnas, y el monto como la suma
// de los subtotales guardados (la proforma suma los subtotales).
async function writtenAmounts(action: OrderAction, form: FormFields, data?: DataOverrides) {
  mocks.correlatives.clear();

  const { calls } = await characterizeHandler(async () => {
    try {
      await action(initialState, formOf(form));
    } catch (error) {
      if (!describeNavigationError(error)) {
        throw error;
      }
    }
  }, { ...CATALOG, ...data });
  const argsOf = (name: string) => {
    const call = calls.find((item) => "prisma" in item && item.prisma === name) as
      | { args: { data: unknown } }
      | undefined;

    return call?.args.data;
  };
  const order = (argsOf("pedido.create") ?? argsOf("pedido.update")) as Record<string, unknown>;
  const details = argsOf("detalle_pedido.createMany") as Record<string, unknown>[];

  return {
    monto: order.monto_estimado,
    lineas: details.map(({ cantidad, precio_unitario, subtotal }) => ({ cantidad, precio_unitario, subtotal })),
  };
}

describe("importes con la regla de la base", () => {
  const decimalLines = lines([PRODUCTO_A, "1.25", "10.25"], [PRODUCTO_B, "1.005", "10"]);
  const expected = {
    monto: "22.91",
    lineas: [
      { cantidad: "1.25", precio_unitario: "10.25", subtotal: "12.81" },
      { cantidad: "1.01", precio_unitario: "10.00", subtotal: "10.10" },
    ],
  };

  it("el alta guarda cada linea redondeada y el monto como suma de subtotales", async () => {
    expect(await writtenAmounts(createOrderAction, { ...orderForm, ...decimalLines })).toEqual(expected);
  });

  it("la edicion guarda lo mismo", async () => {
    expect(await writtenAmounts(updateOrderAction, { ...editForm, ...decimalLines }, orderRow())).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Clientes y productos activos (C3, D3 y hallazgo 5 de la 10.4a)
// ---------------------------------------------------------------------------

// Un cliente o un producto nuevo debe existir y estar activo, en el alta y en
// la edicion; la edicion acepta el cliente y los productos que el pedido ya
// tiene aunque esten inactivos, mientras no se cambien.
async function outcomeOf(action: OrderAction, form: FormFields, data?: DataOverrides) {
  mocks.correlatives.clear();

  const { result } = await characterizeHandler(async () => {
    try {
      return await action(initialState, formOf(form));
    } catch (error) {
      return describeNavigationError(error) ?? `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }, { ...CATALOG, ...data });

  return result;
}

const CLIENT_ERROR = {
  error: "El cliente seleccionado no existe o está inactivo.",
  fieldErrors: { id_cliente: ["El cliente seleccionado no existe o está inactivo."] },
};
const PRODUCT_ERROR = {
  error: "Un producto seleccionado no existe o está inactivo.",
  fieldErrors: { items: ["Un producto seleccionado no existe o está inactivo."] },
};
const CREATED = "redirect:/dashboard/commercial/orders?toast=order-created";
const UPDATED = "redirect:/dashboard/commercial/orders?toast=order-updated";

describe("clientes y productos activos", () => {
  it("el alta rechaza un cliente inactivo", async () => {
    expect(await outcomeOf(createOrderAction, { ...orderForm, id_cliente: CLIENTE_INACTIVO })).toEqual(CLIENT_ERROR);
  });

  it("el alta rechaza un cliente que no existe", async () => {
    expect(await outcomeOf(createOrderAction, { ...orderForm, id_cliente: "CLI00000099" })).toEqual(CLIENT_ERROR);
  });

  it("el alta rechaza un producto inactivo", async () => {
    const form = { ...orderForm, ...lines([PRODUCTO_A, "2", "150"], [PRODUCTO_INACTIVO, "1", "10"]) };

    expect(await outcomeOf(createOrderAction, form)).toEqual(PRODUCT_ERROR);
  });

  it("el alta rechaza un producto que no existe sin llegar a la clave foranea", async () => {
    const form = { ...orderForm, ...lines(["PRO00000099", "1", "10"]) };

    expect(await outcomeOf(createOrderAction, form)).toEqual(PRODUCT_ERROR);
  });

  it("la edicion conserva su cliente inactivo", async () => {
    const form = { ...editForm, id_cliente: CLIENTE_INACTIVO };

    expect(await outcomeOf(updateOrderAction, form, orderRow({ id_cliente: CLIENTE_INACTIVO }))).toBe(UPDATED);
  });

  it("la edicion conserva un producto inactivo que ya tenia", async () => {
    const form = { ...editForm, ...lines([PRODUCTO_INACTIVO, "2", "150"]) };
    const order = orderRow({
      detalle_pedido: [{ id_detalle_pedido: "DPE00000040", id_producto: PRODUCTO_INACTIVO, orden_trabajo: [] }],
    });

    expect(await outcomeOf(updateOrderAction, form, order)).toBe(UPDATED);
  });

  it("la edicion rechaza cambiar a otro cliente inactivo", async () => {
    expect(await outcomeOf(updateOrderAction, { ...editForm, id_cliente: CLIENTE_INACTIVO }, orderRow())).toEqual(
      CLIENT_ERROR,
    );
  });

  it("la edicion rechaza agregar un producto inactivo que no tenia", async () => {
    const form = { ...editForm, ...lines([PRODUCTO_A, "2", "150"], [PRODUCTO_INACTIVO, "1", "10"]) };

    expect(await outcomeOf(updateOrderAction, form, orderRow())).toEqual(PRODUCT_ERROR);
  });

  it("el alta de un cliente y productos activos se guarda", async () => {
    expect(await outcomeOf(createOrderAction, orderForm)).toBe(CREATED);
  });
});

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

defineOrderSuite("createOrderAction", createOrderAction, [
  { name: "ADMIN crea un pedido de dos lineas", form: orderForm },
  { name: "SELLER crea un pedido", form: orderForm, role: "SELLER" },
  { name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma", form: orderForm, role: "WORKSHOP_MASTER" },
  {
    name: "importes con decimales: cada linea redondeada y el monto como suma de subtotales",
    form: { ...orderForm, ...lines([PRODUCTO_A, "1.25", "10.25"], [PRODUCTO_B, "1.25", "10.25"]) },
  },
  {
    name: "importes en coma flotante: 3 x 0.1",
    form: { ...orderForm, ...lines([PRODUCTO_A, "3", "0.1"]) },
  },
  {
    name: "una cantidad de tres decimales se redondea antes de multiplicar",
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
    name: "una clave foranea rota al crear el detalle se propaga",
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
    name: "importes con decimales: cada linea redondeada y el monto como suma de subtotales",
    form: { ...editForm, ...lines([PRODUCTO_A, "1.25", "10.25"], [PRODUCTO_B, "1.25", "10.25"]) },
    data: orderRow(),
  },
  {
    name: "una clave foranea rota despues de borrar el detalle se propaga",
    form: editForm,
    data: { ...orderRow(), "detalle_pedido.createMany": failWith(foreignKeyViolation()) },
  },
]);
