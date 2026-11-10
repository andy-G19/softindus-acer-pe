import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createPurchaseAction } from "@/modules/inventory/purchases/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
} from "@/testing/page-characterization";

// Caracterizacion de crear compra con el arnes (11.2b), escrita antes de tocar la accion.
// Las pruebas de actions.test.ts fijan el stock, el kardex y las alertas con una base en
// memoria; estas fijan en un snapshot la secuencia: la autorizacion, las lecturas (y si van
// fuera de la transaccion), la transaccion con sus correlativos y escrituras, la bitacora, su
// final, las revalidaciones y el resultado (la redireccion o el error exacto).
//
// Los montos de estos casos no llegan al borde del redondeo: los hallazgos 1 a 3 y 6 de la
// 11.2b (montos con number) tienen sus propias pruebas.

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
const PLANCHA = "MAT00000001";
const TUBO = "MAT00000002";

type Line = { id_material: string; cantidad: string; unidad_medida?: string; costo_unitario: string; observaciones?: string };
type ActionCase = {
  name: string;
  header?: Record<string, string>;
  lines?: Line[];
  data?: DataOverrides;
};

const baseHeader: Record<string, string> = {
  id_proveedor: PROVEEDOR,
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

async function runAction(actionCase: ActionCase) {
  mocks.correlatives.clear();

  const { calls, result } = await characterizeHandler(async () => {
    try {
      await createPurchaseAction(formOf(actionCase));

      return "termino sin redirigir";
    } catch (error) {
      return (
        describeNavigationError(error) ??
        `error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, { ...found, ...actionCase.data });

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
  { name: "sin proveedor", header: { id_proveedor: "" } },
  { name: "cantidad cero", lines: [{ id_material: PLANCHA, cantidad: "0", costo_unitario: "10" }] },
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
    lines: [{ id_material: "MAT00000099", cantidad: "1", costo_unitario: "10" }],
  },
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
