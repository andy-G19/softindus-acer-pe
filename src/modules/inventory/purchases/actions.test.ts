import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  annulPurchaseAction,
  createPurchaseAction,
} from "@/modules/inventory/purchases/actions";

// Pruebas de caracterizacion de las acciones de compras.
//
// Ejecutan las acciones reales con dobles de prueba: no hay Next.js, sesion ni
// PostgreSQL. La tabla material, el kardex y el estado de las compras viven en
// una base en memoria que imita lo que importa aqui de PostgreSQL: el redondeo
// al guardar en Decimal(10, 2) y el rollback cuando la transaccion lanza.
//
// Las aserciones miran el estado final y el valor que quedaria guardado, no el
// tipo de JavaScript (number o Decimal), para que sigan valiendo si cambia la
// implementacion. Los tests "defecto:" documentan condiciones de carrera vigentes.
//
// Limite: una base en memoria no demuestra la atomicidad real de PostgreSQL bajo
// concurrencia; eso requiere pruebas de integracion contra una base desechable.

const mocks = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(readonly url: string) {
      super(`redirect: ${url}`);
    }
  }

  return {
    RedirectSignal,
    redirect: vi.fn((url: string) => {
      throw new RedirectSignal(url);
    }),
    revalidatePath: vi.fn(),
    requireRole: vi.fn(),
    registerAuditLog: vi.fn(),
    prisma: {
      proveedor: { findFirst: vi.fn() },
      material: { findMany: vi.fn() },
      compra: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    },
    tx: {
      compra: { create: vi.fn(), update: vi.fn() },
      detalle_compra: { create: vi.fn() },
      material: { update: vi.fn() },
      alerta_stock: { updateMany: vi.fn() },
      movimiento_inventario: { create: vi.fn() },
      historial_precio_proveedor: { create: vi.fn() },
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/authz", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/audit", () => ({ registerAuditLog: mocks.registerAuditLog }));
vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/correlatives", async () => {
  const { formatCorrelativeId } = await import("@/lib/correlatives-format");

  // Cada llamada numera desde 1: basta para saber que id recibe cada registro.
  const nextIds = async (
    _tx: unknown,
    { prefijo, cantidad }: { prefijo: string; cantidad: number },
  ) =>
    Array.from({ length: cantidad }, (_, index) =>
      formatCorrelativeId(prefijo, index + 1),
    );

  return {
    getNextCorrelativeIds: vi.fn(nextIds),
    getNextCorrelativeId: vi.fn(
      async (tx: unknown, { prefijo }: { prefijo: string }) =>
        (await nextIds(tx, { prefijo, cantidad: 1 }))[0],
    ),
  };
});

const USER_ID = "USU00000001";
const SUPPLIER_ID = "PRV00000001";
const PURCHASE_ID = "COM00000001";
const PLANCHA = "MAT00000001";
const TUBO = "MAT00000002";

const PURCHASES_PATH = "/dashboard/inventory/purchases";
const PURCHASE_DETAIL_PATH = `${PURCHASES_PATH}/${PURCHASE_ID}`;

type MaterialRow = {
  id_material: string;
  estado: boolean;
  stock_actual: Prisma.Decimal;
  stock_minimo: Prisma.Decimal;
  costo_unitario_actual: Prisma.Decimal;
};

type PurchaseRow = {
  estado_compra: string;
  estado_pago: string;
  pagos: string[];
  entradas: Array<{ id_material: string; cantidad: Prisma.Decimal }>;
};

type FakeDb = {
  materiales: Map<string, MaterialRow>;
  compras: Map<string, PurchaseRow>;
  kardex: Array<Record<string, unknown>>;
};

type MaterialSelect = Partial<Record<keyof MaterialRow, boolean>>;

type DecimalInput = Prisma.Decimal | number | string;

let db: FakeDb;

/** PostgreSQL redondea al guardar en Decimal(p, 2): mitad lejos del cero. */
function toColumn(value: DecimalInput) {
  return new Prisma.Decimal(value).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
}

/** Escritura de Prisma sobre una columna numerica: valor directo o suma atomica. */
function applyNumericUpdate(
  current: Prisma.Decimal,
  value: DecimalInput | { increment: DecimalInput },
) {
  if (typeof value === "object" && "increment" in value) {
    return toColumn(current.plus(value.increment));
  }

  return toColumn(value);
}

/** Valor que quedaria guardado en la columna, llegue como number o como Decimal. */
function stored(value: unknown) {
  return toColumn(String(value)).toFixed(2);
}

function cloneDb(source: FakeDb): FakeDb {
  return {
    materiales: new Map(
      [...source.materiales].map(([id, row]) => [id, { ...row }]),
    ),
    compras: new Map([...source.compras].map(([id, row]) => [id, { ...row }])),
    kardex: [...source.kardex],
  };
}

function pick(row: MaterialRow, select?: MaterialSelect) {
  if (!select) {
    return { ...row };
  }

  return Object.fromEntries(
    Object.entries(row).filter(([key]) => select[key as keyof MaterialRow]),
  );
}

function materialRow(idMaterial: string) {
  const row = db.materiales.get(idMaterial);

  if (!row) {
    throw new Error(`Material ${idMaterial} no sembrado en la base en memoria.`);
  }

  return row;
}

function stockOf(idMaterial: string) {
  return materialRow(idMaterial).stock_actual.toFixed(2);
}

function seedMaterial(
  idMaterial: string,
  { stock, minimo = "0", estado = true }: { stock: string; minimo?: string; estado?: boolean },
) {
  db.materiales.set(idMaterial, {
    id_material: idMaterial,
    estado,
    stock_actual: toColumn(stock),
    stock_minimo: toColumn(minimo),
    costo_unitario_actual: toColumn(0),
  });
}

function seedPurchase(
  entradas: Array<[idMaterial: string, cantidad: string]>,
  { estado = "confirmada", pagos = [] }: { estado?: string; pagos?: string[] } = {},
) {
  db.compras.set(PURCHASE_ID, {
    estado_compra: estado,
    estado_pago: estado === "anulada" ? "anulada" : "pendiente",
    pagos,
    entradas: entradas.map(([idMaterial, cantidad]) => ({
      id_material: idMaterial,
      cantidad: toColumn(cantidad),
    })),
  });
}

function purchaseState() {
  const row = db.compras.get(PURCHASE_ID);

  return row ? { estado_compra: row.estado_compra, estado_pago: row.estado_pago } : null;
}

function kardexSummary() {
  return db.kardex.map((movement) => ({
    tipo_movimiento: movement.tipo_movimiento,
    id_material: movement.id_material,
    cantidad: stored(movement.cantidad),
    stock_anterior: stored(movement.stock_anterior),
    stock_resultante: stored(movement.stock_resultante),
  }));
}

async function readMaterials({
  where,
  select,
}: {
  where: { id_material: { in: string[] }; estado?: boolean };
  select?: MaterialSelect;
}) {
  return [...db.materiales.values()]
    .filter((row) => where.id_material.in.includes(row.id_material))
    .filter((row) => where.estado === undefined || row.estado === where.estado)
    .map((row) => pick(row, select));
}

async function readPurchase({ where }: { where: { id_compra: string } }) {
  const row = db.compras.get(where.id_compra);

  if (!row) {
    return null;
  }

  return {
    id_compra: where.id_compra,
    estado_compra: row.estado_compra,
    estado_pago: row.estado_pago,
    pago_proveedor: row.pagos.map((idPago) => ({ id_pago_proveedor: idPago })),
    movimiento_inventario: row.entradas.map((entrada) => ({
      ...entrada,
      tipo_movimiento: "entrada",
    })),
  };
}

type PurchaseLine = {
  id_material: string;
  cantidad: string;
  costo_unitario: string;
};

function purchaseForm(lines: PurchaseLine[]) {
  const formData = new FormData();

  formData.set("id_proveedor", SUPPLIER_ID);
  formData.set("fecha_compra", "2026-09-28");
  formData.set("tipo_comprobante", "factura");
  formData.set("numero_comprobante", "F001-00000123");
  formData.set("aplica_igv", "on");
  formData.set("observaciones", "");

  for (const line of lines) {
    formData.append("id_material", line.id_material);
    formData.append("cantidad", line.cantidad);
    formData.append("unidad_medida", "UND");
    formData.append("costo_unitario", line.costo_unitario);
    formData.append("item_observaciones", "");
  }

  return formData;
}

function annulForm() {
  const formData = new FormData();

  formData.set("id_compra", PURCHASE_ID);

  return formData;
}

/** Ejecuta la accion y devuelve la URL a la que redirige. */
async function redirectOf(action: Promise<unknown>) {
  const outcome = await action.then(
    () => new Error("La accion termino sin redirigir."),
    (error: unknown) => error,
  );

  if (outcome instanceof mocks.RedirectSignal) {
    return outcome.url;
  }

  throw outcome;
}

beforeEach(() => {
  vi.resetAllMocks();

  db = { materiales: new Map(), compras: new Map(), kardex: [] };

  mocks.redirect.mockImplementation((url: string) => {
    throw new mocks.RedirectSignal(url);
  });
  mocks.requireRole.mockResolvedValue({ user: { id: USER_ID } });
  mocks.prisma.proveedor.findFirst.mockResolvedValue({
    id_proveedor: SUPPLIER_ID,
    estado: true,
  });
  mocks.prisma.material.findMany.mockImplementation(readMaterials);
  mocks.prisma.compra.findUnique.mockImplementation(readPurchase);

  // Si el callback lanza, se descartan sus escrituras, como hace PostgreSQL.
  mocks.prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => {
      const snapshot = cloneDb(db);

      try {
        return await callback(mocks.tx);
      } catch (error) {
        db = snapshot;
        throw error;
      }
    },
  );

  mocks.tx.material.update.mockImplementation(
    async ({
      where,
      data,
      select,
    }: {
      where: { id_material: string };
      data: {
        stock_actual?: DecimalInput | { increment: DecimalInput };
        costo_unitario_actual?: DecimalInput;
      };
      select?: MaterialSelect;
    }) => {
      const row = materialRow(where.id_material);

      if (data.stock_actual !== undefined) {
        row.stock_actual = applyNumericUpdate(row.stock_actual, data.stock_actual);
      }

      if (data.costo_unitario_actual !== undefined) {
        row.costo_unitario_actual = toColumn(data.costo_unitario_actual);
      }

      return pick(row, select);
    },
  );

  mocks.tx.movimiento_inventario.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => {
      db.kardex.push(data);
      return data;
    },
  );

  mocks.tx.compra.update.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id_compra: string };
      data: { estado_compra: string; estado_pago: string };
    }) => {
      const row = db.compras.get(where.id_compra);

      if (!row) {
        throw new Error(`Compra ${where.id_compra} no encontrada.`);
      }

      Object.assign(row, data);
      return row;
    },
  );
});

describe("createPurchaseAction", () => {
  it("registra compra, detalle, entrada de kardex e historial de precio y redirige con el toast", async () => {
    seedMaterial(PLANCHA, { stock: "10" });
    seedMaterial(TUBO, { stock: "4" });

    const url = await redirectOf(
      createPurchaseAction(
        purchaseForm([
          { id_material: PLANCHA, cantidad: "5", costo_unitario: "12.50" },
          { id_material: TUBO, cantidad: "2.5", costo_unitario: "8" },
        ]),
      ),
    );

    expect(url).toBe(`${PURCHASES_PATH}?toast=purchase-created`);
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN"]);

    expect(mocks.tx.compra.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id_compra: PURCHASE_ID,
        id_proveedor: SUPPLIER_ID,
        id_usuario_registro: USER_ID,
        tipo_comprobante: "factura",
        numero_comprobante: "F001-00000123",
        subtotal: 82.5,
        igv: 14.85,
        monto_total: 97.35,
        estado_pago: "pendiente",
        estado_compra: "confirmada",
        observaciones: null,
      }),
    });

    expect(mocks.tx.detalle_compra.create.mock.calls).toEqual([
      [
        {
          data: {
            id_detalle_compra: "DCO00000001",
            id_compra: PURCHASE_ID,
            id_material: PLANCHA,
            cantidad: 5,
            unidad_medida: "UND",
            costo_unitario: 12.5,
            subtotal: 62.5,
            observaciones: null,
          },
        },
      ],
      [
        {
          data: {
            id_detalle_compra: "DCO00000002",
            id_compra: PURCHASE_ID,
            id_material: TUBO,
            cantidad: 2.5,
            unidad_medida: "UND",
            costo_unitario: 8,
            subtotal: 20,
            observaciones: null,
          },
        },
      ],
    ]);

    expect(stockOf(PLANCHA)).toBe("15.00");
    expect(stockOf(TUBO)).toBe("6.50");
    expect(materialRow(PLANCHA).costo_unitario_actual.toFixed(2)).toBe("12.50");
    expect(materialRow(TUBO).costo_unitario_actual.toFixed(2)).toBe("8.00");

    expect(kardexSummary()).toEqual([
      {
        tipo_movimiento: "entrada",
        id_material: PLANCHA,
        cantidad: "5.00",
        stock_anterior: "10.00",
        stock_resultante: "15.00",
      },
      {
        tipo_movimiento: "entrada",
        id_material: TUBO,
        cantidad: "2.50",
        stock_anterior: "4.00",
        stock_resultante: "6.50",
      },
    ]);
    expect(db.kardex[0]).toMatchObject({
      id_movimiento: "MVI00000001",
      id_compra: PURCHASE_ID,
      motivo: "Entrada automática generada por compra confirmada",
      id_usuario_responsable: USER_ID,
    });
    expect(db.kardex[1]).toMatchObject({ id_movimiento: "MVI00000002" });

    expect(mocks.tx.historial_precio_proveedor.create).toHaveBeenCalledWith({
      data: {
        id_historial_precio: "HPP00000001",
        id_proveedor: SUPPLIER_ID,
        id_material: PLANCHA,
        id_compra: PURCHASE_ID,
        precio_unitario: 12.5,
        fecha_registro: new Date("2026-09-28"),
        origen_registro: "compra",
        observaciones: "Precio registrado automáticamente desde compra.",
      },
    });

    expect(mocks.registerAuditLog).toHaveBeenCalledWith({
      userId: USER_ID,
      entidad_afectada: "compra",
      id_registro_afectado: PURCHASE_ID,
      accion: "crear",
      detalle: "Compra creada con 2 material(es).",
      tx: mocks.tx,
    });

    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/dashboard/inventory"],
      ["/dashboard/inventory/materials"],
      [PURCHASES_PATH],
    ]);
  });

  it("atiende las alertas activas cuando el stock resultante supera el minimo", async () => {
    seedMaterial(PLANCHA, { stock: "2", minimo: "5" });

    await redirectOf(
      createPurchaseAction(
        purchaseForm([{ id_material: PLANCHA, cantidad: "5", costo_unitario: "10" }]),
      ),
    );

    expect(mocks.tx.alerta_stock.updateMany).toHaveBeenCalledWith({
      where: {
        id_material: PLANCHA,
        estado_alerta: "activa",
      },
      data: {
        estado_alerta: "atendida",
        fecha_atencion: expect.any(Date),
        id_usuario_atencion: USER_ID,
      },
    });
  });

  it("no atiende alertas si el stock resultante queda igual al minimo", async () => {
    seedMaterial(PLANCHA, { stock: "3", minimo: "8" });

    await redirectOf(
      createPurchaseAction(
        purchaseForm([{ id_material: PLANCHA, cantidad: "5", costo_unitario: "10" }]),
      ),
    );

    expect(stockOf(PLANCHA)).toBe("8.00");
    expect(mocks.tx.alerta_stock.updateMany).not.toHaveBeenCalled();
  });

  it("rechaza materiales inactivos sin tocar el stock", async () => {
    seedMaterial(PLANCHA, { stock: "10", estado: false });

    await expect(
      createPurchaseAction(
        purchaseForm([{ id_material: PLANCHA, cantidad: "5", costo_unitario: "10" }]),
      ),
    ).rejects.toThrow("Uno o más materiales no existen o están inactivos.");

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(stockOf(PLANCHA)).toBe("10.00");
  });

  it("suma el stock con increment atomico y un Decimal, dentro de la transaccion", async () => {
    seedMaterial(PLANCHA, { stock: "10" });

    await redirectOf(
      createPurchaseAction(
        purchaseForm([{ id_material: PLANCHA, cantidad: "5", costo_unitario: "12.50" }]),
      ),
    );

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.material.update).toHaveBeenCalledTimes(1);

    const [{ where, data, select }] = mocks.tx.material.update.mock.calls[0];

    expect(where).toEqual({ id_material: PLANCHA });
    expect(data).toEqual({
      stock_actual: { increment: expect.any(Prisma.Decimal) },
      costo_unitario_actual: 12.5,
    });
    expect(data.stock_actual.increment.toFixed(2)).toBe("5.00");
    expect(select).toEqual({ stock_actual: true, stock_minimo: true });
  });

  it("no pierde una compra concurrente: el kardex parte del stock que devuelve la base", async () => {
    seedMaterial(PLANCHA, { stock: "10" });

    mocks.prisma.material.findMany.mockImplementationOnce(async (args) => {
      const snapshot = await readMaterials(args);

      // Otra compra de 10 unidades confirma despues de esta lectura.
      materialRow(PLANCHA).stock_actual = toColumn("20");

      return snapshot;
    });

    await redirectOf(
      createPurchaseAction(
        purchaseForm([{ id_material: PLANCHA, cantidad: "5", costo_unitario: "10" }]),
      ),
    );

    expect(stockOf(PLANCHA)).toBe("25.00");
    expect(kardexSummary()).toEqual([
      {
        tipo_movimiento: "entrada",
        id_material: PLANCHA,
        cantidad: "5.00",
        stock_anterior: "20.00",
        stock_resultante: "25.00",
      },
    ]);
  });

  it("redondea la cantidad como la columna para que el kardex cuadre", async () => {
    seedMaterial(PLANCHA, { stock: "10" });

    await redirectOf(
      createPurchaseAction(
        purchaseForm([{ id_material: PLANCHA, cantidad: "1.005", costo_unitario: "10" }]),
      ),
    );

    // Sin redondear, el stock anterior se deduciria como 11.01 - 1.005 = 10.005 -> 10.01.
    expect(stockOf(PLANCHA)).toBe("11.01");
    expect(kardexSummary()).toEqual([
      {
        tipo_movimiento: "entrada",
        id_material: PLANCHA,
        cantidad: "1.01",
        stock_anterior: "10.00",
        stock_resultante: "11.01",
      },
    ]);
  });
});

describe("annulPurchaseAction", () => {
  it("revierte el stock, registra la salida en kardex, anula la compra y redirige con el toast", async () => {
    seedMaterial(PLANCHA, { stock: "15" });
    seedMaterial(TUBO, { stock: "6.5" });
    seedPurchase([
      [PLANCHA, "5"],
      [TUBO, "2.5"],
    ]);

    const url = await redirectOf(annulPurchaseAction(annulForm()));

    expect(url).toBe(`${PURCHASES_PATH}?toast=purchase-annulled`);
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN"]);

    expect(stockOf(PLANCHA)).toBe("10.00");
    expect(stockOf(TUBO)).toBe("4.00");
    expect(kardexSummary()).toEqual([
      {
        tipo_movimiento: "salida",
        id_material: PLANCHA,
        cantidad: "5.00",
        stock_anterior: "15.00",
        stock_resultante: "10.00",
      },
      {
        tipo_movimiento: "salida",
        id_material: TUBO,
        cantidad: "2.50",
        stock_anterior: "6.50",
        stock_resultante: "4.00",
      },
    ]);
    expect(db.kardex[0]).toMatchObject({
      id_movimiento: "MVI00000001",
      id_compra: PURCHASE_ID,
      motivo: `Reversion por anulacion de compra ${PURCHASE_ID}`,
      id_usuario_responsable: USER_ID,
    });
    expect(db.kardex[1]).toMatchObject({ id_movimiento: "MVI00000002" });

    expect(purchaseState()).toEqual({
      estado_compra: "anulada",
      estado_pago: "anulada",
    });

    expect(mocks.registerAuditLog).toHaveBeenCalledWith({
      userId: USER_ID,
      entidad_afectada: "compra",
      id_registro_afectado: PURCHASE_ID,
      accion: "anular",
      detalle: `Compra anulada con reversion de inventario: ${PURCHASE_ID}`,
      tx: mocks.tx,
    });

    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/dashboard/inventory"],
      ["/dashboard/inventory/materials"],
      [PURCHASES_PATH],
      [PURCHASE_DETAIL_PATH],
    ]);
  });

  it("vuelve al detalle sin revertir ningun material si uno no tiene stock suficiente", async () => {
    seedMaterial(PLANCHA, { stock: "15" });
    seedMaterial(TUBO, { stock: "2" });
    seedPurchase([
      [PLANCHA, "5"],
      [TUBO, "2.5"],
    ]);

    const url = await redirectOf(annulPurchaseAction(annulForm()));

    expect(url).toBe(PURCHASE_DETAIL_PATH);
    expect(stockOf(PLANCHA)).toBe("15.00");
    expect(stockOf(TUBO)).toBe("2.00");
    expect(kardexSummary()).toEqual([]);
    expect(purchaseState()).toEqual({
      estado_compra: "confirmada",
      estado_pago: "pendiente",
    });
    expect(mocks.registerAuditLog).not.toHaveBeenCalled();
  });

  it("vuelve al detalle sin revertir nada si la compra tiene pagos", async () => {
    seedMaterial(PLANCHA, { stock: "15" });
    seedPurchase([[PLANCHA, "5"]], { pagos: ["PPR00000001"] });

    const url = await redirectOf(annulPurchaseAction(annulForm()));

    expect(url).toBe(PURCHASE_DETAIL_PATH);
    expect(stockOf(PLANCHA)).toBe("15.00");
    expect(kardexSummary()).toEqual([]);
    expect(purchaseState()?.estado_compra).toBe("confirmada");
  });

  it("vuelve al listado sin revertir nada si la compra ya esta anulada", async () => {
    seedMaterial(PLANCHA, { stock: "15" });
    seedPurchase([[PLANCHA, "5"]], { estado: "anulada" });

    const url = await redirectOf(annulPurchaseAction(annulForm()));

    expect(url).toBe(PURCHASES_PATH);
    expect(stockOf(PLANCHA)).toBe("15.00");
    expect(kardexSummary()).toEqual([]);
  });

  it("defecto: una anulacion concurrente de la misma compra revierte el stock dos veces", async () => {
    seedMaterial(PLANCHA, { stock: "15" });
    seedPurchase([[PLANCHA, "5"]]);

    mocks.prisma.compra.findUnique.mockImplementationOnce(async (args) => {
      const snapshot = await readPurchase(args);

      // Otra solicitud anula la misma compra y confirma despues de esta lectura.
      materialRow(PLANCHA).stock_actual = toColumn("10");
      Object.assign(db.compras.get(PURCHASE_ID) ?? {}, {
        estado_compra: "anulada",
        estado_pago: "anulada",
      });
      db.kardex.push({
        tipo_movimiento: "salida",
        id_material: PLANCHA,
        cantidad: "5",
        stock_anterior: "15",
        stock_resultante: "10",
      });

      return snapshot;
    });

    const url = await redirectOf(annulPurchaseAction(annulForm()));

    expect(url).toBe(`${PURCHASES_PATH}?toast=purchase-annulled`);
    expect(stockOf(PLANCHA)).toBe("5.00");
    expect(kardexSummary()).toEqual([
      {
        tipo_movimiento: "salida",
        id_material: PLANCHA,
        cantidad: "5.00",
        stock_anterior: "15.00",
        stock_resultante: "10.00",
      },
      {
        tipo_movimiento: "salida",
        id_material: PLANCHA,
        cantidad: "5.00",
        stock_anterior: "10.00",
        stock_resultante: "5.00",
      },
    ]);
  });
});
