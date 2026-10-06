import { describe, expect, it, vi } from "vitest";

import {
  characterizeHandler,
  generatedResult,
  normalizeIntlStrings,
  preloadPages,
  type DataOverrides,
  type PrismaArgs,
  type RecordedCall,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de la exportacion de reportes (entrega 5), escrita antes de
// dividir route.ts en un registro de exportadores. Cada caso fija, en orden:
// la sesion, las lecturas de Prisma, el registro de la exportacion
// (correlativo, exportacion_datos y bitacora), la entrada completa del
// generador de Excel o PDF y la respuesta. Los generadores (lib/excel-export y
// lib/pdf-export) no cambian en la entrega: con la misma entrada y el mismo
// reloj producen el mismo archivo.

const mocks = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock({
    transactions: true,
  }),
);
vi.mock("@/auth", () => ({ auth: async () => mocks.session }));
vi.mock("@/lib/logger", async () => {
  const { recordEffect } = await import("@/testing/page-characterization");
  const describeValue = (value: unknown) =>
    value instanceof Error ? { name: value.name, message: value.message } : value;
  const log =
    (level: string) => (message: string, context?: Record<string, unknown>) => {
      recordEffect(`logger.${level}`, {
        message,
        context:
          context &&
          Object.fromEntries(
            Object.entries(context).map(([key, value]) => [key, describeValue(value)]),
          ),
      });
    };

  return {
    logger: {
      debug: log("debug"),
      info: log("info"),
      warn: log("warn"),
      error: log("error"),
    },
  };
});
vi.mock("@/lib/correlatives", async () => {
  const { recordEffect } = await import("@/testing/page-characterization");

  return {
    getNextCorrelativeId: async (_tx: unknown, params: unknown) => {
      recordEffect("getNextCorrelativeId", params);

      return "EXP00000007";
    },
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
vi.mock("@/lib/excel-export", async (importOriginal) => {
  const { recordEffect } = await import("@/testing/page-characterization");

  return {
    ...(await importOriginal<typeof import("@/lib/excel-export")>()),
    buildExcelBuffer: async (input: unknown) => {
      recordEffect("buildExcelBuffer", input);

      return Buffer.from("contenido excel");
    },
  };
});
vi.mock("@/lib/pdf-export", async (importOriginal) => {
  const { recordEffect } = await import("@/testing/page-characterization");

  return {
    ...(await importOriginal<typeof import("@/lib/pdf-export")>()),
    buildPdfBuffer: async (input: unknown) => {
      recordEffect("buildPdfBuffer", input);

      return Buffer.from("contenido pdf");
    },
  };
});

type Row = Record<string, unknown>;

type ExportCase = {
  name: string;
  report: string;
  query?: Record<string, string>;
  role?: Role;
  session?: "none" | "invalid";
  data?: DataOverrides;
};

const loadRoute = () => import("./route");

function sessionFor(exportCase: ExportCase) {
  if (exportCase.session === "none") {
    return null;
  }

  const invalid = exportCase.session === "invalid";

  // Lo que deja src/auth.ts: una sesion revalidada contra la base, o una
  // vaciada cuando el usuario ya no esta activo.
  return {
    user: {
      id: invalid ? "" : "USU00000001",
      name: "Usuario de prueba",
      role: invalid ? "" : (exportCase.role ?? "ADMIN"),
      status: invalid ? "inactivo" : "activo",
    },
    expires: "2099-01-01T00:00:00.000Z",
  };
}

async function runExport(exportCase: ExportCase) {
  const { GET } = await loadRoute();
  const search = new URLSearchParams(exportCase.query).toString();
  const url = `http://localhost/api/reports/export/${exportCase.report}${
    search ? `?${search}` : ""
  }`;

  mocks.session = sessionFor(exportCase);

  const { calls, result: response } = await characterizeHandler(
    () =>
      GET(new Request(url), {
        params: Promise.resolve({ report: exportCase.report }),
      }),
    exportCase.data,
  );
  const contentType = response.headers.get("content-type") ?? "";

  return {
    calls: normalizeIntlStrings(calls) as RecordedCall[],
    response: {
      status: response.status,
      contentType,
      contentDisposition: response.headers.get("content-disposition"),
      cacheControl: response.headers.get("cache-control"),
      body: contentType.includes("json") ? await response.json() : await response.text(),
    },
  };
}

function generated(model: string, args: PrismaArgs) {
  return generatedResult(model, "findMany", args) as Row[];
}

// Filas generadas con cambios: la fila i recibe changes[i].
function withChanges(model: string, changes: Row[]) {
  return (args: PrismaArgs) =>
    generated(model, args).map((row, index) => ({ ...row, ...changes[index] }));
}

function repeatRows(model: string, total: number, idField: string, prefix: string) {
  return (args: PrismaArgs) => {
    const rows = generated(model, args);

    return Array.from({ length: total }, (_, index) => ({
      ...rows[index % rows.length],
      [idField]: `${prefix}${String(index + 1).padStart(8, "0")}`,
    }));
  };
}

const failQuery = (message: string) => () => {
  throw new Error(message);
};

// Pedidos con los cuatro estados de cobranza: con saldo (pagos de cada tipo),
// sin proforma, pagado y sin pago.
function salesWithCollectionStates(args: PrismaArgs) {
  const [first, second] = generated("pedido", args);
  const quote = (first.proforma as Row[])[0];
  const payment = (quote.pago_cliente as Row[])[0];
  const emptyQuote = ((second.proforma as Row[])[0]);

  return [
    {
      ...first,
      proforma: [
        {
          ...quote,
          pago_cliente: ["adelanto", "amortizacion", "cancelacion", "otro"].map(
            (tipo_pago, index) => ({
              ...payment,
              id_pago_cliente: `PCL0000000${index + 1}`,
              tipo_pago,
            }),
          ),
        },
      ],
    },
    { ...second, id_pedido: "PED00000002", proforma: [] },
    {
      ...first,
      id_pedido: "PED00000003",
      proforma: [{ ...quote, saldo: "0", pago_cliente: [] }],
    },
    {
      ...second,
      id_pedido: "PED00000004",
      proforma: [{ ...emptyQuote, adelanto_inicial: null, pago_cliente: [] }],
    },
  ];
}

const ERROR_CASES: ExportCase[] = [
  { name: "sin sesion", report: "production", session: "none" },
  { name: "sesion invalidada", report: "production", session: "invalid" },
  { name: "reporte desconocido", report: "ventas" },
  {
    name: "reporte desconocido sin sesion no revela que no existe",
    report: "ventas",
    session: "none",
  },
  { name: "vendedor en produccion", report: "production", role: "SELLER" },
  {
    name: "maestro de taller en ventas y cobranzas",
    report: "sales-collections",
    role: "WORKSHOP_MASTER",
  },
  { name: "formato no soportado", report: "audit", query: { fileFormat: "xml" } },
  {
    name: "fecha inicial mayor que la final",
    report: "production",
    query: { dateFrom: "2026-07-31", dateTo: "2026-07-01" },
  },
  {
    name: "rango mayor de 366 dias",
    report: "inventory",
    query: { dateFrom: "2025-01-01", dateTo: "2026-07-01" },
  },
  {
    name: "el alias from/to tambien se valida en un reporte que no lo usa",
    report: "production",
    query: { from: "2026-07-31", to: "2026-07-01" },
  },
  {
    name: "fallo de la consulta",
    report: "production",
    data: { "orden_trabajo.findMany": failQuery("conexion perdida") },
  },
  {
    name: "fallo del registro de la exportacion",
    report: "staff",
    data: { "exportacion_datos.create": failQuery("restriccion violada") },
  },
];

const REPORT_CASES: ExportCase[] = [
  // Produccion
  { name: "produccion: excel sin filtros", report: "production" },
  {
    name: "produccion: pdf con todos los filtros, maestro de taller",
    report: "production",
    role: "WORKSHOP_MASTER",
    query: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      productId: "PRO00000001",
      status: "en_proceso",
      orderId: " otr0000 ",
      fileFormat: "pdf",
    },
  },
  {
    name: "produccion: orden sin cliente, ruta ni avances",
    report: "production",
    data: {
      "orden_trabajo.findMany": withChanges("orden_trabajo", [
        { cliente: null, ruta_fabricacion: null, avance_orden: [] },
      ]),
    },
  },
  {
    name: "produccion: limite pedido",
    report: "production",
    query: { limit: "3" },
  },
  {
    name: "produccion: limite excesivo en excel",
    report: "production",
    query: { limit: "99999" },
  },
  {
    name: "produccion: limite excesivo en pdf",
    report: "production",
    query: { limit: "99999", fileFormat: "pdf" },
  },
  {
    name: "produccion: limite invalido",
    report: "production",
    query: { limit: "abc", fileFormat: "excel" },
  },

  // Inventario
  { name: "inventario: excel sin filtros", report: "inventory", role: "WORKSHOP_MASTER" },
  {
    name: "inventario: pdf con todos los filtros",
    report: "inventory",
    query: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-15",
      materialId: "MAT00000001",
      movementType: "salida",
      userId: "USU00000002",
      workOrderId: "otr00000001",
      fileFormat: "pdf",
    },
  },
  {
    name: "inventario: movimiento sin orden ni compra",
    report: "inventory",
    data: {
      "movimiento_inventario.findMany": withChanges("movimiento_inventario", [
        { orden_trabajo: null, compra: null },
      ]),
    },
  },

  // Ventas y cobranzas
  { name: "ventas: excel sin filtros, vendedor", report: "sales-collections", role: "SELLER" },
  {
    name: "ventas: pdf con todos los filtros",
    report: "sales-collections",
    query: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      clientId: "CLI00000001",
      orderStatus: "aprobado",
      searchCode: "pf-0001",
      fileFormat: "pdf",
    },
  },
  {
    name: "ventas: los cuatro estados de cobranza",
    report: "sales-collections",
    data: { "pedido.findMany": salesWithCollectionStates },
  },
  {
    name: "ventas: filtro por estado de cobranza en memoria",
    report: "sales-collections",
    query: { collectionStatus: "pagado" },
    data: { "pedido.findMany": salesWithCollectionStates },
  },

  // Proveedores y compras
  { name: "compras: excel sin filtros", report: "suppliers-purchases" },
  {
    name: "compras: pdf con todos los filtros",
    report: "suppliers-purchases",
    query: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      supplierId: "PRV00000001",
      materialId: "MAT00000001",
      purchaseStatus: "confirmada",
      paymentStatus: "parcial",
      searchCode: "f001",
      fileFormat: "pdf",
    },
  },
  {
    name: "compras: compra sin detalle, pagos ni historial",
    report: "suppliers-purchases",
    data: {
      "compra.findMany": withChanges("compra", [
        { detalle_compra: [], pago_proveedor: [], historial_precio_proveedor: [] },
      ]),
    },
  },

  // Financiero
  { name: "financiero: excel sin filtros", report: "financial" },
  {
    name: "financiero: pdf con todos los filtros",
    report: "financial",
    query: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      cashBoxId: "CCH00000001",
      movementType: "egreso",
      categoryId: "CGA00000001",
      searchText: " Combustible ",
      fileFormat: "pdf",
    },
  },
  {
    name: "financiero: totales vacios y movimiento sin categoria",
    report: "financial",
    data: {
      "caja_chica.aggregate": { _sum: { saldo_actual: null } },
      "pago_cliente.aggregate": { _sum: { monto_pagado: null } },
      "costeo.aggregate": { _sum: { costo_total: null } },
      "rentabilidad.aggregate": {
        _sum: { ingreso_estimado: null, costo_total: null, utilidad_estimada: null },
      },
      "proforma.aggregate": { _sum: { saldo: null } },
      "compra.findMany": [],
      "movimiento_caja.findMany": withChanges("movimiento_caja", [
        { categoria_gasto: null, tipo_movimiento: "ingreso" },
        { tipo_movimiento: "egreso" },
      ]),
    },
  },

  // Mantenimiento
  {
    name: "mantenimiento: excel sin filtros, maestro de taller",
    report: "maintenance",
    role: "WORKSHOP_MASTER",
  },
  {
    name: "mantenimiento: pdf con todos los filtros",
    report: "maintenance",
    query: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      machineId: "MAQ00000001",
      failureStatus: "pendiente",
      repairStatus: "ejecutada",
      preventiveStatus: "pendiente",
      searchText: "MAQ-01",
      fileFormat: "pdf",
    },
  },
  {
    name: "mantenimiento: falla sin reparaciones",
    report: "maintenance",
    data: {
      "falla_maquina.findMany": withChanges("falla_maquina", [{ reparacion: [] }]),
    },
  },

  // Costos y rentabilidad
  { name: "rentabilidad: excel sin filtros", report: "profitability" },
  {
    name: "rentabilidad: pdf con los nombres de la exportacion",
    report: "profitability",
    query: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      searchText: "Estructura",
      lowMargin: "true",
      fileFormat: "pdf",
    },
  },
  {
    name: "rentabilidad: alias de la pantalla con margen bajo y utilidad negativa",
    report: "profitability",
    query: {
      q: "Estructura",
      from: "2026-07-01",
      to: "2026-07-31",
      lowMargin: "true",
      negativeProfit: "true",
    },
  },
  {
    name: "rentabilidad: costeo sin pedido, orden, margen ni rentabilidad",
    report: "profitability",
    data: {
      "costeo.findMany": withChanges("costeo", [
        { pedido: null, orden_trabajo: null, margen_ganancia: [], rentabilidad: [] },
      ]),
    },
  },

  // Personal y planillas
  { name: "personal: excel sin filtros", report: "staff" },
  {
    name: "personal: pdf con los nombres de la exportacion",
    report: "staff",
    query: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      operatorId: "OPE00000001",
      payrollStatus: "pendiente",
      paymentMode: "semanal",
      searchText: "Quispe",
      fileFormat: "pdf",
    },
  },
  {
    name: "personal: alias de la pantalla",
    report: "staff",
    query: {
      q: "Quispe",
      operario: "OPE00000001",
      modalidad: "semanal",
      estado: "pagado",
      from: "2026-07-01",
      to: "2026-07-31",
    },
    data: {
      "planilla_pago.findMany": withChanges("planilla_pago", [
        { historial_pago_operario: [] },
      ]),
    },
  },

  // Auditoria
  { name: "auditoria: excel sin filtros", report: "audit" },
  {
    name: "auditoria: pdf con los nombres de la exportacion",
    report: "audit",
    query: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      userId: "USU00000002",
      action: "crear",
      entity: "cliente",
      searchText: "CLI",
      fileFormat: "pdf",
    },
  },
  {
    name: "auditoria: alias de la pantalla",
    report: "audit",
    query: {
      q: "CLI",
      usuario: "USU00000002",
      accion: "crear",
      entidad: "cliente",
      from: "2026-07-01",
      to: "2026-07-31",
    },
  },
];

function effectArgs(calls: RecordedCall[], effect: string) {
  const call = calls.find((item) => "effect" in item && item.effect === effect);

  return (call && "effect" in call ? call.args : undefined) as {
    rows: unknown[][];
    note?: string;
    metadata?: string;
  };
}

describe("GET /api/reports/export/[report]", () => {
  preloadPages(loadRoute);

  describe("rechazos y errores", () => {
    for (const exportCase of ERROR_CASES) {
      it(exportCase.name, async () => {
        expect(await runExport(exportCase)).toMatchSnapshot();
      });
    }
  });

  describe("archivos por reporte", () => {
    for (const exportCase of REPORT_CASES) {
      it(exportCase.name, async () => {
        expect(await runExport(exportCase)).toMatchSnapshot();
      });
    }
  });

  describe("recortes de seguridad", () => {
    it("el pdf dibuja 80 filas y avisa cuantas habia", async () => {
      const { calls, response } = await runExport({
        name: "pdf truncado",
        report: "audit",
        query: { fileFormat: "pdf" },
        data: {
          "bitacora_operacion.findMany": repeatRows(
            "bitacora_operacion",
            85,
            "id_registro_afectado",
            "REG",
          ),
        },
      });
      const pdf = effectArgs(calls, "buildPdfBuffer");

      expect(response.status).toBe(200);
      expect(pdf.rows).toHaveLength(80);
      expect(pdf.rows[79]).toContain("REG00000080");
      expect(pdf.note).toBe("Reporte limitado a 80 de 85 registros por seguridad.");
      expect(effectArgs(calls, "registerAuditLog")).toMatchObject({
        detalle: "Reporte exportado: Reporte de auditoria (pdf). Registros: 80.",
      });
    });

    it("el excel combinado de mantenimiento se recorta a 5000 filas", async () => {
      const { calls, response } = await runExport({
        name: "excel truncado",
        report: "maintenance",
        query: { limit: "5000" },
        data: {
          "falla_maquina.findMany": repeatRows("falla_maquina", 3000, "id_falla", "FAL"),
          "mantenimiento_preventivo.findMany": repeatRows(
            "mantenimiento_preventivo",
            3000,
            "id_mantenimiento",
            "MPR",
          ),
        },
      });
      const excel = effectArgs(calls, "buildExcelBuffer");

      expect(response.status).toBe(200);
      expect(excel.rows).toHaveLength(5000);
      expect(excel.rows[2999]?.slice(0, 2)).toEqual(["Falla", "FAL00003000"]);
      expect(excel.rows[4999]?.slice(0, 2)).toEqual(["Preventivo", "MPR00002000"]);
      expect(excel.metadata).toContain("Total exportado: 5000 | Límite aplicado: 5000");
    });
  });
});
