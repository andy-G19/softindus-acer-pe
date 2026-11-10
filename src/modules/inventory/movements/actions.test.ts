import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createInventoryOutputAction } from "@/modules/inventory/movements/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isPrismaRead,
  type DataOverrides,
  type PrismaArgs,
} from "@/testing/page-characterization";

// Caracterizacion de la salida de inventario (grupo 1 de fixes), escrita antes
// de corregir H9.
//
// La accion se usa con useActionState: un rechazo de validacion no lanza,
// devuelve un estado con el error y los errores de campo. Cada caso ejecuta
// la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion,
// las lecturas, la transaccion con el bloqueo del material, sus escrituras y
// su final, el correlativo, la bitacora, las revalidaciones y el resultado:
// el estado devuelto, la redireccion o el error relanzado.
//
// Hasta el fix de H9 la orden asociada solo se comprobaba, fuera de la
// transaccion, que existiera, y las ordenes anuladas, finalizadas o con los
// materiales cerrados recibian la salida. Desde H9 la transaccion bloquea la
// orden y rechaza esos casos en el campo de la orden.
//
// Desde C2 de la 11.2c la accion devuelve un FormActionState (no redirige),
// rechaza un rol sin permiso con un error en lugar de redirigir (era la
// desviacion conocida) y reclama la clave de la operacion como primera
// sentencia de la transaccion.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
// Cada respuesta lleva un operationId aleatorio: se fija para que el snapshot sea estable.
vi.mock("@/lib/action-result", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/action-result")>()),
  newOperationId: () => "operacion-de-prueba",
}));
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

  return {
    ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
    getNextCorrelativeId: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string },
    ) => {
      recordEffect("getNextCorrelativeId", params);

      const next = (mocks.correlatives.get(params.prefijo) ?? 0) + 1;

      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
    // La regla de alertas de stock (C4 de la 11.2c) reserva el id de la alerta con esta.
    getNextCorrelativeIds: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string; cantidad: number },
    ) => {
      recordEffect("getNextCorrelativeIds", params);

      const last = mocks.correlatives.get(params.prefijo) ?? 0;

      mocks.correlatives.set(params.prefijo, last + params.cantidad);

      return Array.from({ length: params.cantidad }, (_, index) =>
        formatCorrelativeId(params.prefijo, last + index + 1),
      );
    },
  };
});

expect.addSnapshotSerializer(decimalSnapshotSerializer);

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

type ActionCase = {
  name: string;
  form: Record<string, string>;
  data?: DataOverrides;
  role?: "ADMIN" | "SELLER" | "WORKSHOP_MASTER";
};

async function runAction(actionCase: ActionCase) {
  mocks.correlatives.clear();

  const formData = new FormData();

  for (const [key, value] of Object.entries(actionCase.form)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        // El mismo estado inicial que usa el formulario con useActionState.
        return await createInventoryOutputAction({ status: "idle" }, formData);
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `lanzo: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    actionCase.data,
    { role: actionCase.role },
  );

  return { calls, outcome: result };
}

// Los casos por nombre, para que las pruebas del fix los repitan sin copiarlos.
const cases: ActionCase[] = [];

function defineCases(actionCases: ActionCase[]) {
  cases.push(...actionCases);

  describe("createInventoryOutputAction", () => {
    for (const actionCase of actionCases) {
      it(actionCase.name, async () => {
        const { calls, outcome } = await runAction(actionCase);

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

const D = (value: string) => new Prisma.Decimal(value);

const MATERIAL = "MAT00000006";
const OT = "OTR00000007";

type Row = Record<string, unknown>;

function materialRow(changes: Row = {}) {
  return {
    id_material: MATERIAL,
    nombre_material: "Plancha LAC 2 mm",
    stock_actual: D("12.50"),
    stock_reservado: D("2.25"),
    stock_minimo: D("1.00"),
    estado: true,
    ...changes,
  };
}

// El bloqueo del material es SQL crudo: el caso responde segun la tabla.
function lockedRows(material: Row | null) {
  return (args: PrismaArgs) =>
    String(args?.sql).includes("FROM aceros.material") && material ? [material] : [];
}

function workOrderRow(changes: Row = {}) {
  return {
    id_orden_trabajo: OT,
    estado: "en_proceso",
    fecha_cierre_materiales: null,
    ...changes,
  };
}

const CLAVE = "0b6f1d9e-3c4a-4f2b-9e7d-5a6b7c8d9e0f";

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Row = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: "registrar_salida",
      id_usuario: "USU00000001",
      id_registro_resultado: "MVI00000009",
      ...changes,
    },
  };
}

const form = (changes: Record<string, string> = {}) => ({
  id_material: MATERIAL,
  clave_operacion: CLAVE,
  id_orden_trabajo: "",
  cantidad: "3.75",
  motivo: "Corte de prueba",
  ...changes,
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases([
  {
    name: "datos invalidos: devuelve los errores de campo sin consultar",
    form: form({ id_material: " ", cantidad: "0", motivo: "ab" }),
  },
  {
    name: "la orden no existe: error en el campo de la orden y se revierte",
    form: form({ id_orden_trabajo: ` ${OT} ` }),
    data: { "orden_trabajo.findUnique": null },
  },
  {
    name: "el material no existe: error en el campo del material y se revierte",
    form: form(),
    data: { $queryRaw: lockedRows(null) },
  },
  {
    name: "material inactivo: error en el campo del material",
    form: form(),
    data: { $queryRaw: lockedRows(materialRow({ estado: false })) },
  },
  {
    name: "stock disponible insuficiente: descuenta lo reservado",
    form: form({ cantidad: "10.26" }),
    data: { $queryRaw: lockedRows(materialRow()) },
  },
  {
    name: "sin orden: descuenta el stock, registra el kardex y la bitacora con el material",
    form: form({ cantidad: "10.25" }),
    data: { $queryRaw: lockedRows(materialRow()) },
  },
  {
    name: "con orden en proceso: la asocia al movimiento y a la bitacora",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow(),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "orden anulada: rechaza la salida en el campo de la orden",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow({ estado: "anulada" }),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "orden finalizada: rechaza la salida en el campo de la orden",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow({ estado: "finalizada" }),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "orden con materiales cerrados: rechaza la salida en el campo de la orden",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        fecha_cierre_materiales: new Date("2026-07-10T15:00:00.000Z"),
      }),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "el maestro de taller registra la salida igual",
    form: form(),
    data: { $queryRaw: lockedRows(materialRow()) },
    role: "WORKSHOP_MASTER",
  },
  {
    name: "sin permiso: responde con un error en el formulario, sin redirigir",
    form: form(),
    role: "SELLER",
  },
  {
    name: "sin clave de operacion",
    form: form({ clave_operacion: "" }),
  },
  {
    name: "clave repetida: responde con la salida guardada sin escribir",
    form: form(),
    data: storedKey(),
  },
  {
    name: "clave de otro usuario",
    form: form(),
    data: storedKey({ id_usuario: "USU00000009" }),
  },
  {
    name: "un error inesperado dentro de la transaccion se relanza",
    form: form(),
    data: {
      $queryRaw: lockedRows(materialRow()),
      "material.update": () => {
        throw new Error("Conexion interrumpida.");
      },
    },
  },
]);

// ---------------------------------------------------------------------------
// H9 (grupo 1 de fixes): la salida a una orden aplica la regla de la entrega
// ---------------------------------------------------------------------------

// La salida solo comprobaba, fuera de la transaccion, que la orden existiera:
// aceptaba ordenes anuladas, finalizadas o con los materiales cerrados, y una
// anulacion simultanea podia colarse. Ahora, si hay orden, la transaccion la
// bloquea antes de leerla y aplica la misma regla que la entrega desde la
// orden, con el error en el campo de la orden y sin escribir nada.
function findCase(name: string) {
  const actionCase = cases.find((item) => item.name === name);

  if (!actionCase) {
    throw new Error(`No existe el caso "${name}".`);
  }

  return actionCase;
}

describe("H9: la salida a una orden decide con la orden bloqueada", () => {
  const withWorkOrder = cases.filter((actionCase) => actionCase.form.id_orden_trabajo.trim() !== "");

  it("cubre los 5 casos con orden", () => {
    expect(withWorkOrder).toHaveLength(5);
  });

  for (const actionCase of withWorkOrder) {
    it(actionCase.name, async () => {
      const { calls } = await runAction(actionCase);

      expectRowLockedBefore(calls, { table: "orden_trabajo", id: OT, reads: isPrismaRead });
    });
  }
});

describe("H9: rechaza la salida a una orden que ya no admite material", () => {
  const rejected = [
    ["orden anulada: rechaza la salida en el campo de la orden", "No se puede entregar material a una orden anulada o finalizada."],
    ["orden finalizada: rechaza la salida en el campo de la orden", "No se puede entregar material a una orden anulada o finalizada."],
    ["orden con materiales cerrados: rechaza la salida en el campo de la orden", "Los materiales de esta orden ya fueron cerrados."],
  ];

  for (const [caseName, message] of rejected) {
    it(caseName, async () => {
      const { calls, outcome } = await runAction(findCase(caseName));
      const writes = calls.filter(
        (call) => "prisma" in call && /\.(create|update)$/.test(call.prisma),
      );

      expect(outcome).toMatchObject({
        status: "error",
        error: message,
        fieldErrors: { id_orden_trabajo: [message] },
      });
      expect(writes).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// C1 de la 11.2c (hallazgos 1 y 2): la cantidad como la guarda la columna
// ---------------------------------------------------------------------------

// La accion restaba la cantidad sin redondear y cada columna redondeaba por su cuenta: con un
// stock de 10.00, una salida de 1.005 guardaba cantidad 1.01 y resultante 9.00, y el kardex no
// cuadraba (10.00 - 1.01 = 8.99). Una de 0.004 se guardaba como un movimiento de 0.00. Lo que
// importa es el valor que guarda la columna numeric(10, 2), no el tipo de JavaScript.
describe("C1 de la 11.2c: la cantidad de la salida redondeada como la columna", () => {
  const stored = (value: unknown) => new Prisma.Decimal(String(value)).toFixed(2);
  const ten = { $queryRaw: lockedRows(materialRow({ stock_actual: D("10.00"), stock_reservado: D("0.00") })) };

  function writeOf(calls: Awaited<ReturnType<typeof runAction>>["calls"], name: string) {
    const call = calls.find((item) => "prisma" in item && item.prisma === name);

    expect(call, `no se llamo a ${name}`).toBeDefined();

    return (call as { args: { data: Record<string, unknown> } }).args.data;
  }

  it.each([
    ["1.005", "1.01", "8.99"],
    ["2.675", "2.68", "7.32"],
  ])("una salida de %s: el kardex cuadra con lo que guardan las columnas", async (cantidad, guardada, resultante) => {
    const { calls } = await runAction({ name: `salida de ${cantidad}`, form: form({ cantidad }), data: ten });

    const kardex = writeOf(calls, "movimiento_inventario.create");

    expect({
      cantidad: stored(kardex.cantidad),
      anterior: stored(kardex.stock_anterior),
      resultante: stored(kardex.stock_resultante),
    }).toEqual({ cantidad: guardada, anterior: "10.00", resultante });
    expect(stored(writeOf(calls, "material.update").stock_actual)).toBe(resultante);
  });

  it("compara con el disponible la cantidad redondeada: 1.004 es 1.00 y cabe en 1.00", async () => {
    const { outcome } = await runAction({
      name: "1.004 con 1.00 disponible",
      form: form({ cantidad: "1.004" }),
      data: { $queryRaw: lockedRows(materialRow({ stock_actual: D("1.00"), stock_reservado: D("0.00") })) },
    });

    expect(outcome).toMatchObject({ status: "success" });
  });

  it("una cantidad que se guardaria como 0.00 se rechaza en su campo sin abrir la transaccion", async () => {
    const { calls, outcome } = await runAction({ name: "0.004", form: form({ cantidad: "0.004" }), data: ten });

    expect(outcome).toMatchObject({
      status: "error",
      error: "Revisa los datos de la salida.",
      fieldErrors: { cantidad: ["La cantidad debe ser mayor que cero."] },
    });
    expect(calls.some((call) => "effect" in call && call.effect === "prisma.$transaction")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// C2 de la 11.2c: idempotencia de la salida
// ---------------------------------------------------------------------------

// La clave se reclama como primera sentencia de la transaccion, antes del bloqueo de la orden y
// del material y antes del correlativo: un reenvio responde con la salida ya guardada y no
// descuenta el stock otra vez.
describe("C2 de la 11.2c: idempotencia de la salida", () => {
  const isPrisma = (call: { prisma?: string }, name: string) => call.prisma === name;

  it("reclama la clave antes de bloquear y la completa con el movimiento", async () => {
    const { calls, outcome } = await runAction(findCase("con orden en proceso: la asocia al movimiento y a la bitacora"));
    const index = (name: string) => calls.findIndex((call) => "prisma" in call && isPrisma(call, name));

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_movimiento: "MVI00000001", clave_operacion: CLAVE },
    });
    expect(index("operacion_idempotente.createManyAndReturn")).toBeGreaterThan(-1);
    expect(index("operacion_idempotente.createManyAndReturn")).toBeLessThan(index("$queryRaw"));
    expect(index("movimiento_inventario.create")).toBeLessThan(index("operacion_idempotente.updateMany"));
  });

  it("una clave repetida no bloquea, no descuenta stock ni escribe el kardex", async () => {
    const { calls, outcome } = await runAction(findCase("clave repetida: responde con la salida guardada sin escribir"));

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_movimiento: "MVI00000009", clave_operacion: CLAVE },
    });
    expect(calls.some((call) => "prisma" in call && isPrisma(call, "$queryRaw"))).toBe(false);
    expect(calls.some((call) => "prisma" in call && isPrisma(call, "material.update"))).toBe(false);
    expect(calls.some((call) => "prisma" in call && isPrisma(call, "movimiento_inventario.create"))).toBe(false);
  });

  it("sin permiso responde en el formulario y no redirige (se retira la desviacion conocida)", async () => {
    const { calls, outcome } = await runAction(findCase("sin permiso: responde con un error en el formulario, sin redirigir"));

    expect(outcome).toMatchObject({ status: "error", error: "No tienes permisos para registrar salidas de inventario." });
    expect(calls.some((call) => "prisma" in call)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// C4 de la 11.2c (D16): la salida aplica la regla de alertas de stock
// ---------------------------------------------------------------------------

// La entrega a una orden abria o actualizaba la alerta de stock critico y la salida no
// (hallazgo 3 de la 10.3a): una salida podia dejar un material bajo el minimo sin alerta. Ahora
// aplica la misma regla, con el stock que calculo bajo el bloqueo del material: en el minimo o
// por debajo abre la alerta o actualiza la activa; por encima atiende la activa. El mensaje
// nombra la orden si la hay.
describe("C4 de la 11.2c: la salida abre, actualiza o atiende la alerta de stock", () => {
  const stock = (actual: string, minimo: string): DataOverrides => ({
    $queryRaw: lockedRows(materialRow({ stock_actual: D(actual), stock_reservado: D("0.00"), stock_minimo: D(minimo) })),
  });
  const ACTIVA = { id_alerta: "ALE00000004" };

  type Calls = Awaited<ReturnType<typeof runAction>>["calls"];

  const alertCalls = (calls: Calls, kind: RegExp) =>
    calls
      .filter((call) => "prisma" in call && kind.test(call.prisma))
      .map((call) => ({ prisma: (call as { prisma: string }).prisma, args: (call as { args: unknown }).args }));
  const alertWrites = (calls: Calls) => alertCalls(calls, /^alerta_stock\.(create|update)/);

  it("sin orden, deja el stock en el minimo: abre la alerta con el mensaje de la salida", async () => {
    const { calls, outcome } = await runAction({
      name: "salida al minimo",
      form: form({ cantidad: "3.00" }),
      data: { ...stock("8.00", "5.00"), "alerta_stock.findFirst": null },
    });

    expect(outcome).toMatchObject({ status: "success" });
    expect(alertWrites(calls)).toEqual([
      {
        prisma: "alerta_stock.create",
        args: {
          data: {
            id_alerta: "ALE00000001",
            id_material: MATERIAL,
            stock_detectado: 5,
            stock_minimo: 5,
            estado_alerta: "activa",
            mensaje: "El material Plancha LAC 2 mm quedo en stock critico tras una salida de inventario.",
          },
        },
      },
    ]);
  });

  it("con orden, deja el stock bajo el minimo con una alerta activa: la actualiza con la orden", async () => {
    const { calls } = await runAction({
      name: "salida a una orden bajo el minimo",
      form: form({ id_orden_trabajo: OT, cantidad: "3.00" }),
      data: { ...stock("6.00", "5.00"), "orden_trabajo.findUnique": workOrderRow(), "alerta_stock.findFirst": ACTIVA },
    });

    expect(alertWrites(calls)).toEqual([
      {
        prisma: "alerta_stock.update",
        args: {
          where: { id_alerta: "ALE00000004" },
          data: {
            stock_detectado: 3,
            stock_minimo: 5,
            mensaje: `El material Plancha LAC 2 mm quedo en stock critico tras mover la orden ${OT}.`,
          },
        },
      },
    ]);
  });

  it("deja el stock por encima del minimo con una alerta activa: la atiende", async () => {
    const { calls } = await runAction({
      name: "salida por encima del minimo",
      form: form({ cantidad: "3.00" }),
      data: { ...stock("20.00", "5.00"), "alerta_stock.findFirst": ACTIVA },
    });

    expect(alertWrites(calls)).toEqual([
      {
        prisma: "alerta_stock.update",
        args: {
          where: { id_alerta: "ALE00000004" },
          data: {
            estado_alerta: "atendida",
            fecha_atencion: expect.any(Date),
            id_usuario_atencion: "USU00000001",
            stock_detectado: 17,
            mensaje: "El material Plancha LAC 2 mm recupero stock por encima del minimo.",
          },
        },
      },
    ]);
  });

  it("busca la alerta activa del material, dentro de la transaccion y despues del kardex", async () => {
    const { calls } = await runAction({
      name: "salida sin alerta",
      form: form({ cantidad: "3.00" }),
      data: { ...stock("20.00", "5.00"), "alerta_stock.findFirst": null },
    });
    const index = (name: string) => calls.findIndex((call) => "prisma" in call && call.prisma === name);

    expect(alertCalls(calls, /^alerta_stock\./)).toEqual([
      {
        prisma: "alerta_stock.findFirst",
        args: { where: { id_material: MATERIAL, estado_alerta: "activa" }, select: { id_alerta: true } },
      },
    ]);
    expect(index("alerta_stock.findFirst")).toBeGreaterThan(index("movimiento_inventario.create"));
    expect(index("alerta_stock.findFirst")).toBeLessThan(index("operacion_idempotente.updateMany"));
  });

  it("un rechazo por stock insuficiente no toca las alertas", async () => {
    const { calls } = await runAction(findCase("stock disponible insuficiente: descuenta lo reservado"));

    expect(alertCalls(calls, /^alerta_stock\./)).toEqual([]);
  });
});
