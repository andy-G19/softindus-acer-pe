import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createPurchaseAction } from "@/modules/inventory/purchases/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type RecordedCall,
  type PrismaArgs,
} from "@/testing/page-characterization";

// Caracterizacion de crear compra con el arnes (11.2b), escrita antes de tocar la accion.
// Las pruebas de actions.test.ts fijan el stock, el kardex y las alertas con una base en
// memoria; estas fijan en un snapshot la secuencia: la autorizacion, el reclamo de la clave,
// las lecturas, la transaccion con sus correlativos y escrituras, la bitacora, su final, las
// revalidaciones y el resultado que recibe el formulario. Desde C3 la accion devuelve un
// FormActionState: no redirige ni lanza.
//
// Los montos de estos casos no llegan al borde del redondeo: los hallazgos 1 a 3 y 6 de la
// 11.2b (montos con number) tienen sus propias pruebas.

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

  const reserve = (prefijo: string, cantidad: number) => {
    const last = mocks.correlatives.get(prefijo) ?? 0;

    mocks.correlatives.set(prefijo, last + cantidad);

    return Array.from({ length: cantidad }, (_, index) =>
      formatCorrelativeId(prefijo, last + index + 1),
    );
  };

  return {
    ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
    getNextCorrelativeId: async (_tx: unknown, params: { codigoEntidad: string; prefijo: string }) => {
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

expect.addSnapshotSerializer(decimalSnapshotSerializer);

const D = (value: string) => new Prisma.Decimal(value);

const PROVEEDOR = "PVE00000001";
const CLAVE = "0b6f1d9e-3c4a-4f2b-9e7d-5a6b7c8d9e0f";
const TIPO = "crear_compra";
const PLANCHA = "MAT00000001";
const TUBO = "MAT00000002";

type Line = { id_material: string; cantidad: string; unidad_medida?: string; costo_unitario: string; observaciones?: string };
type ActionCase = {
  name: string;
  header?: Record<string, string>;
  lines?: Line[];
  data?: DataOverrides;
  role?: "ADMIN" | "SELLER" | "WORKSHOP_MASTER";
};

const baseHeader: Record<string, string> = {
  id_proveedor: PROVEEDOR,
  clave_operacion: CLAVE,
  fecha_compra: "2026-07-14",
  tipo_comprobante: "",
  numero_comprobante: "",
  observaciones: "",
};

const supplier = { id_proveedor: PROVEEDOR, razon_social: "Aceros del Sur", estado: true };

const material = (id_material: string) => ({
  id_material,
  nombre_material: id_material === PLANCHA ? "Plancha 3 mm" : "Tubo 2 pulgadas",
  estado: true,
  stock_actual: D("10.00"),
  stock_minimo: D("5.00"),
  costo_unitario_actual: D("1.00"),
});

/** El stock que devuelve la base tras sumar: 10 + la cantidad. */
function stockAfterIncrement(args: PrismaArgs) {
  const data = args?.data as { stock_actual: { increment: Prisma.Decimal } };

  return { stock_actual: D("10.00").plus(data.stock_actual.increment), stock_minimo: D("5.00") };
}

const found: DataOverrides = {
  "proveedor.findFirst": supplier,
  // Ninguna compra con el mismo comprobante (C4 de la 11.2b).
  "compra.findFirst": null,
  "material.findMany": (args: PrismaArgs) => {
    const ids = ((args?.where as { id_material: { in: string[] } }).id_material.in);

    return ids.filter((id) => id === PLANCHA || id === TUBO).map(material);
  },
  "material.update": stockAfterIncrement,
};

function formOf({ header, lines }: ActionCase) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({ ...baseHeader, ...header })) {
    formData.append(key, value);
  }

  for (const line of lines ?? [{ id_material: PLANCHA, cantidad: "2", costo_unitario: "10.50" }]) {
    formData.append("id_material", line.id_material);
    formData.append("cantidad", line.cantidad);
    formData.append("unidad_medida", line.unidad_medida ?? "UND");
    formData.append("costo_unitario", line.costo_unitario);
    formData.append("item_observaciones", line.observaciones ?? "");
  }

  return formData;
}

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Record<string, unknown> = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: TIPO,
      id_usuario: "USU00000001",
      id_registro_resultado: "COM00000007",
      ...changes,
    },
  };
}

async function runAction(actionCase: ActionCase) {
  mocks.correlatives.clear();

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        return await createPurchaseAction({ status: "idle" }, formOf(actionCase));
      } catch (error) {
        return `lanzo: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    { ...found, ...actionCase.data },
    { role: actionCase.role },
  );

  return { calls, outcome: result };
}

const cases: ActionCase[] = [
  { name: "una linea sin IGV" },
  {
    name: "dos lineas con factura e IGV",
    header: {
      tipo_comprobante: "factura",
      numero_comprobante: "F001-000123",
      aplica_igv: "on",
      observaciones: "  compra mensual  ",
    },
    lines: [
      { id_material: PLANCHA, cantidad: "3", costo_unitario: "12.50", observaciones: " corte a medida " },
      { id_material: TUBO, cantidad: "2", unidad_medida: "m", costo_unitario: "7.25" },
    ],
  },
  {
    name: "el stock resultante queda igual al minimo: no atiende alertas",
    data: {
      "material.update": () => ({ stock_actual: D("5.00"), stock_minimo: D("5.00") }),
    },
  },
  { name: "sin permiso", role: "SELLER" },
  { name: "sin clave de operacion", header: { clave_operacion: "" } },
  { name: "sin proveedor", header: { id_proveedor: "" } },
  {
    name: "cantidad cero en la segunda linea",
    lines: [
      { id_material: PLANCHA, cantidad: "1", costo_unitario: "10" },
      { id_material: TUBO, cantidad: "0", costo_unitario: "10" },
    ],
  },
  {
    name: "material repetido",
    lines: [
      { id_material: PLANCHA, cantidad: "1", costo_unitario: "10" },
      { id_material: PLANCHA, cantidad: "2", costo_unitario: "10" },
    ],
  },
  { name: "proveedor inexistente o inactivo", data: { "proveedor.findFirst": null } },
  {
    name: "material inexistente o inactivo",
    lines: [
      { id_material: PLANCHA, cantidad: "1", costo_unitario: "10" },
      { id_material: "MAT00000099", cantidad: "1", costo_unitario: "10" },
    ],
  },
  { name: "clave repetida: responde con la compra guardada sin escribir", data: storedKey() },
  { name: "clave de otro usuario", data: storedKey({ id_usuario: "USU00000009" }) },
];

describe("createPurchaseAction", () => {
  for (const actionCase of cases) {
    it(actionCase.name, async () => {
      const { calls, outcome } = await runAction(actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});

const isPrisma = (call: RecordedCall, name: string) => "prisma" in call && call.prisma === name;

// C3 de la 11.2b: la clave del formulario se reclama como primera sentencia de la
// transaccion, y el proveedor y los materiales se comprueban despues, dentro de ella (D20).
describe("C3 de la 11.2b: idempotencia y lecturas dentro de la transaccion", () => {
  it("reclama la clave, lee dentro de la transaccion y completa la clave con la compra", async () => {
    const { calls, outcome } = await runAction(cases[0]);
    const index = (name: string) => calls.findIndex((call) => isPrisma(call, name));
    const transaction = calls.findIndex((call) => "effect" in call && call.effect === "prisma.$transaction");

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_compra: "COM00000001", clave_operacion: CLAVE },
    });
    expect(transaction).toBeGreaterThan(-1);
    expect(index("operacion_idempotente.createManyAndReturn")).toBeGreaterThan(transaction);
    expect(index("proveedor.findFirst")).toBeGreaterThan(index("operacion_idempotente.createManyAndReturn"));
    expect(index("material.findMany")).toBeGreaterThan(transaction);
    expect(index("compra.create")).toBeLessThan(index("operacion_idempotente.updateMany"));
    expect(calls[index("operacion_idempotente.updateMany")]).toMatchObject({
      args: { where: { clave: CLAVE }, data: { id_registro_resultado: "COM00000001" } },
    });
  });

  it("una clave repetida responde con la compra guardada sin leer ni escribir", async () => {
    const { calls, outcome } = await runAction({ name: "repetida", data: storedKey() });

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_compra: "COM00000007", clave_operacion: CLAVE },
    });
    expect(calls.some((call) => isPrisma(call, "proveedor.findFirst"))).toBe(false);
    expect(calls.some((call) => isPrisma(call, "compra.create"))).toBe(false);
    expect(calls.some((call) => isPrisma(call, "material.update"))).toBe(false);
  });

  it("cada error de linea va con la clave de su linea", async () => {
    const zero = await runAction(cases.find((item) => item.name === "cantidad cero en la segunda linea")!);
    const repeated = await runAction(cases.find((item) => item.name === "material repetido")!);
    const inactive = await runAction(cases.find((item) => item.name === "material inexistente o inactivo")!);

    expect(zero.outcome).toMatchObject({ fieldErrors: { "items.1.cantidad": ["La cantidad debe ser mayor que cero."] } });
    expect(repeated.outcome).toMatchObject({ fieldErrors: { "items.1.id_material": [expect.any(String)] } });
    expect(inactive.outcome).toMatchObject({
      fieldErrors: { "items.1.id_material": ["El material seleccionado no existe o está inactivo."] },
    });
  });
});

// Hallazgos 1 a 3 y 6 de la 11.2b: los montos se calculaban con number y cada columna
// redondeaba por su cuenta. Lo que importa es el valor que guarda la columna numeric(_, 2),
// no el tipo de JavaScript: `stored` lo redondea como Postgres (mitad lejos del cero).
describe("hallazgos 1 a 3 y 6 de la 11.2b: montos de la compra", () => {
  const stored = (value: unknown) => new Prisma.Decimal(String(value)).toFixed(2);

  function writesOf(calls: Awaited<ReturnType<typeof runAction>>["calls"], name: string) {
    return calls
      .filter((call) => "prisma" in call && call.prisma === name)
      .map((call) => (call as { args: { data: Record<string, unknown> } }).args.data);
  }

  function purchaseOf(calls: Awaited<ReturnType<typeof runAction>>["calls"]) {
    const [compra] = writesOf(calls, "compra.create");

    return {
      subtotal: stored(compra.subtotal),
      igv: stored(compra.igv),
      total: stored(compra.monto_total),
    };
  }

  it("hallazgo 1: subtotal + IGV = total con dos lineas de 1.25 x 10.25", async () => {
    const { calls } = await runAction({
      name: "1.25 x 10.25 dos veces",
      header: { tipo_comprobante: "factura", numero_comprobante: "F001-000777", aplica_igv: "on" },
      lines: [
        { id_material: PLANCHA, cantidad: "1.25", costo_unitario: "10.25" },
        { id_material: TUBO, cantidad: "1.25", costo_unitario: "10.25" },
      ],
    });

    expect(writesOf(calls, "detalle_compra.create").map((line) => stored(line.subtotal))).toEqual([
      "12.81",
      "12.81",
    ]);
    expect(purchaseOf(calls)).toEqual({ subtotal: "25.62", igv: "4.61", total: "30.23" });
  });

  it("hallazgo 2: el subtotal de la linea sale de la cantidad redondeada: 1.005 x 10", async () => {
    const { calls } = await runAction({
      name: "1.005 x 10",
      lines: [{ id_material: PLANCHA, cantidad: "1.005", costo_unitario: "10" }],
    });

    const [line] = writesOf(calls, "detalle_compra.create");

    expect({ cantidad: stored(line.cantidad), subtotal: stored(line.subtotal) }).toEqual({
      cantidad: "1.01",
      subtotal: "10.10",
    });
    expect(purchaseOf(calls)).toEqual({ subtotal: "10.10", igv: "0.00", total: "10.10" });
  });

  it("hallazgo 3: con montos pequenos el total es subtotal + IGV: 0.5 x 0.15 con IGV", async () => {
    const { calls } = await runAction({
      name: "0.5 x 0.15",
      header: { aplica_igv: "on" },
      lines: [{ id_material: PLANCHA, cantidad: "0.5", costo_unitario: "0.15" }],
    });

    expect(purchaseOf(calls)).toEqual({ subtotal: "0.08", igv: "0.01", total: "0.09" });
  });

  it("hallazgo 6: el costo se guarda redondeado igual en la linea, el material y el historial", async () => {
    const { calls } = await runAction({
      name: "costo 10.255",
      lines: [{ id_material: PLANCHA, cantidad: "1", costo_unitario: "10.255" }],
    });

    const [line] = writesOf(calls, "detalle_compra.create");
    const [materialUpdate] = writesOf(calls, "material.update");
    const [history] = writesOf(calls, "historial_precio_proveedor.create");

    // Lo que se envia es lo que se guarda: el texto ya redondeado, no el number.
    expect(line.costo_unitario).toBe("10.26");
    expect(materialUpdate.costo_unitario_actual).toBe("10.26");
    expect(history.precio_unitario).toBe("10.26");
    expect(stored(line.subtotal)).toBe("10.26");
  });
});

// C4 de la 11.2b (hallazgos 4 y 5): un comprobante repetido rompia en el indice unico
// uq_compra_comprobante (P2002) y una fecha inexistente llegaba a Prisma; los dos mostraban la
// pagina de error. Ahora responden en su campo y no escriben nada.
describe("C4 de la 11.2b: comprobante repetido y fecha invalida", () => {
  const withReceipt = { tipo_comprobante: "factura", numero_comprobante: "F001-000123", aplica_igv: "on" };
  const RECEIPT_TAKEN = "Ya existe una compra con ese tipo y número de comprobante.";

  it("un comprobante ya registrado se rechaza en su campo, dentro de la transaccion", async () => {
    const { calls, outcome } = await runAction({
      name: "comprobante registrado",
      header: withReceipt,
      data: { "compra.findFirst": { id_compra: "COM00000003" } },
    });

    expect(outcome).toMatchObject({
      status: "error",
      error: RECEIPT_TAKEN,
      fieldErrors: { numero_comprobante: [RECEIPT_TAKEN] },
    });
    expect(calls.some((call) => isPrisma(call, "compra.create"))).toBe(false);
    expect(calls.at(-1)).toMatchObject({ effect: "prisma.$transaction:rollback" });
  });

  it("si otra compra gana la carrera, el indice unico responde igual en su campo", async () => {
    const { outcome } = await runAction({
      name: "comprobante en carrera",
      header: withReceipt,
      data: {
        "compra.create": () => {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "7.8.0",
            meta: { target: ["tipo_comprobante", "numero_comprobante"] },
          });
        },
      },
    });

    expect(outcome).toMatchObject({
      status: "error",
      error: RECEIPT_TAKEN,
      fieldErrors: { numero_comprobante: [RECEIPT_TAKEN] },
    });
  });

  it("sin numero no se busca un comprobante repetido", async () => {
    const { calls, outcome } = await runAction({
      name: "boleta sin numero",
      header: { tipo_comprobante: "boleta", numero_comprobante: "" },
    });

    expect(outcome).toMatchObject({ status: "success" });
    expect(calls.some((call) => isPrisma(call, "compra.findFirst"))).toBe(false);
  });

  it.each(["2026-02-30", "hola", "2026-7-1"])("la fecha %s se rechaza en su campo sin abrir la transaccion", async (fecha) => {
    const { calls, outcome } = await runAction({ name: `fecha ${fecha}`, header: { fecha_compra: fecha } });

    expect(outcome).toMatchObject({
      status: "error",
      fieldErrors: { fecha_compra: ["La fecha de compra no es válida."] },
    });
    expect(calls.some((call) => "effect" in call && call.effect === "prisma.$transaction")).toBe(false);
  });
});
