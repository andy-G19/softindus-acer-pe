import { describe, expect, it, vi } from "vitest";

import { REPORT_REGISTRY, type ReportKey } from "@/lib/reports/report-registry";
import {
  characterizeHandler,
  characterizePage,
  isPrismaCall,
  preloadPages,
  type PageLoader,
  type PrismaCall,
  type RecordedCall,
} from "@/testing/page-characterization";

// Paridad entre pantalla y exportacion (grupo 4 de fixes). Cada caso ejecuta
// la pagina real con sus filtros, toma el enlace "Exportar Excel" que genera y
// lo pasa por la ruta de exportacion: la consulta principal del archivo debe
// usar el mismo where que la de la pantalla. El enlace de la pantalla es el
// contrato de la exportacion.

const mocks = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock({
    transactions: true,
  }),
);
vi.mock("@/auth", () => ({ auth: async () => mocks.session }));
// Las paginas usan el doble de requireRole; la ruta, la autorizacion real con
// la sesion simulada de @/auth.
vi.mock("@/lib/authz", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requireRole: (await import("@/testing/page-characterization")).authzModuleMock()
    .requireRole,
}));
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);
vi.mock("@/lib/correlatives", () => ({
  getNextCorrelativeId: async () => "EXP00000007",
}));
vi.mock("@/lib/audit", () => ({ registerAuditLog: async () => {} }));
vi.mock("@/lib/excel-export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/excel-export")>()),
  buildExcelBuffer: async () => Buffer.from("contenido excel"),
}));

type ParityCase = {
  name: string;
  searchParams: Record<string, string>;
};

type ParityReport = {
  report: string;
  route: string;
  load: PageLoader;
  // Lecturas principales: las que comparten el filtro de la pantalla.
  mainQueries: string[];
  // Mientras la exportacion no use el filtro de la pantalla, el caso compara
  // solo la condicion de este campo de fecha.
  dateField?: string;
  cases: ParityCase[];
};

const loadRoute = () => import("./route");

const REPORTS: ParityReport[] = [
  {
    report: "maintenance",
    route: "/dashboard/reports/maintenance",
    load: () => import("@/app/(dashboard)/dashboard/reports/maintenance/page"),
    mainQueries: ["falla_maquina.findMany", "mantenimiento_preventivo.findMany"],
    cases: [
      { name: "sin filtros", searchParams: {} },
      { name: "busqueda por codigo interno", searchParams: { searchText: " MAQ-01 " } },
      {
        name: "todos los filtros",
        searchParams: {
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          machineId: "MAQ00000001",
          failureStatus: "pendiente",
          repairStatus: "ejecutada",
          preventiveStatus: "pendiente",
          searchText: "torno",
        },
      },
    ],
  },
  {
    report: "profitability",
    route: "/dashboard/reports/profitability",
    load: () => import("@/app/(dashboard)/dashboard/reports/profitability/page"),
    mainQueries: ["costeo.findMany"],
    cases: [
      { name: "sin filtros", searchParams: {} },
      {
        name: "margen bajo y utilidad negativa a la vez",
        searchParams: { lowMargin: "true", negativeProfit: "true" },
      },
      {
        name: "busqueda y margen bajo",
        searchParams: { q: " Estructura ", lowMargin: "true" },
      },
      {
        name: "rango de fechas",
        searchParams: { from: "2026-07-01", to: "2026-07-31" },
      },
      {
        name: "fecha escrita sin ceros",
        searchParams: { from: "2026-7-5" },
      },
      {
        name: "todos los filtros",
        searchParams: {
          q: " Estructura ",
          from: "2026-07-01",
          to: "2026-07-31",
          lowMargin: "true",
          negativeProfit: "true",
        },
      },
    ],
  },
  {
    report: "staff",
    route: "/dashboard/reports/staff",
    load: () => import("@/app/(dashboard)/dashboard/reports/staff/page"),
    mainQueries: ["planilla_pago.findMany"],
    cases: [
      { name: "sin filtros", searchParams: {} },
      { name: "rango de fechas", searchParams: { from: "2026-07-01", to: "2026-07-31" } },
      { name: "un solo dia", searchParams: { from: "2026-07-15", to: "2026-07-15" } },
      { name: "fecha escrita sin ceros", searchParams: { from: "2026-7-5" } },
      {
        name: "todos los filtros",
        searchParams: {
          q: " Quispe ",
          operario: "OPE00000001",
          modalidad: "semanal",
          estado: "pagado",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
    ],
  },
  {
    report: "audit",
    route: "/dashboard/audit",
    load: () => import("@/app/(dashboard)/dashboard/audit/page"),
    mainQueries: ["bitacora_operacion.findMany"],
    cases: [
      { name: "sin filtros", searchParams: {} },
      { name: "rango de fechas", searchParams: { from: "2026-07-01", to: "2026-07-31" } },
      { name: "un solo dia", searchParams: { from: "2026-07-15", to: "2026-07-15" } },
      { name: "fecha escrita sin ceros", searchParams: { from: "2026-7-5" } },
      {
        name: "todos los filtros",
        searchParams: {
          q: "cliente",
          usuario: "USU00000001",
          accion: "crear",
          entidad: "cliente",
          from: "2026-07-01",
          to: "2026-07-31",
          page: "2",
        },
      },
    ],
  },
];

function exportHref(html: string | null, report: string) {
  const hrefs = [...(html ?? "").matchAll(/href="(\/api\/reports\/export\/[^"]+)"/g)].map(
    (match) => match[1].replaceAll("&amp;", "&"),
  );
  const excel = hrefs.find(
    (href) =>
      href.startsWith(`/api/reports/export/${report}?`) &&
      new URL(href, "http://localhost").searchParams.get("fileFormat") === "excel",
  );

  if (!excel) {
    throw new Error(`La pantalla no genera el enlace de Excel de ${report}.`);
  }

  return excel;
}

// Condicion de un campo dentro de un where, este en un AND o en el objeto.
function fieldCondition(where: unknown, field: string): unknown {
  if (!where || typeof where !== "object") {
    return undefined;
  }

  const record = where as Record<string, unknown>;

  if (field in record) {
    return record[field];
  }

  const and = Array.isArray(record.AND) ? record.AND : [];

  return and.map((item) => fieldCondition(item, field)).find(Boolean);
}

// La primera lectura de cada consulta principal que recibe un where: la
// bitacora tambien se lee sin filtro para las listas de acciones y entidades.
function mainWheres(calls: RecordedCall[], mainQueries: string[]) {
  return Object.fromEntries(
    mainQueries.map((name) => {
      const call = calls.find(
        (item): item is PrismaCall =>
          isPrismaCall(item) &&
          item.prisma === name &&
          "where" in ((item.args ?? {}) as object),
      );

      return [name, (call?.args as { where?: unknown } | undefined)?.where];
    }),
  );
}

async function runExport(report: string, href: string) {
  const { GET } = await loadRoute();

  mocks.session = {
    user: { id: "USU00000001", name: "Usuario de prueba", role: "ADMIN", status: "activo" },
    expires: "2099-01-01T00:00:00.000Z",
  };

  const { calls, result } = await characterizeHandler(() =>
    GET(new Request(`http://localhost${href}`), {
      params: Promise.resolve({ report }),
    }),
  );

  return { status: result.status, calls };
}

async function screenAndExport(parityReport: ParityReport, parityCase: ParityCase) {
  const page = await characterizePage(
    parityReport.load,
    { name: parityCase.name, searchParams: parityCase.searchParams },
    parityReport.route,
  );
  const { status, calls } = await runExport(
    parityReport.report,
    exportHref(page.html, parityReport.report),
  );

  return {
    status,
    screen: mainWheres(page.calls, parityReport.mainQueries),
    exported: mainWheres(calls, parityReport.mainQueries),
  };
}

// Parametros que la exportacion aceptaba sin que ninguna pantalla los generara
// (alias retirados en el grupo 4 de fixes), con valores distintos de los de
// la pantalla para que un alias que siguiera filtrando se note.
type AliasCase = {
  report: string;
  mainQueries: string[];
  retired: Record<string, string>;
  screen: Record<string, string>;
};

const ALIAS_CASES: AliasCase[] = [
  {
    report: "profitability",
    mainQueries: ["costeo.findMany"],
    retired: { dateFrom: "2026-06-01", dateTo: "2026-06-30", searchText: "Puerta" },
    screen: { from: "2026-07-01", to: "2026-07-31", q: "Estructura" },
  },
  {
    report: "staff",
    mainQueries: ["planilla_pago.findMany"],
    retired: {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      operatorId: "OPE00000002",
      payrollStatus: "pendiente",
      paymentMode: "quincenal",
      searchText: "Mamani",
    },
    screen: {
      from: "2026-07-01",
      to: "2026-07-31",
      operario: "OPE00000001",
      estado: "pagado",
      modalidad: "semanal",
      q: "Quispe",
    },
  },
  {
    report: "audit",
    mainQueries: ["bitacora_operacion.findMany"],
    retired: {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      userId: "USU00000003",
      action: "editar",
      entity: "pedido",
      searchText: "PED",
    },
    screen: {
      from: "2026-07-01",
      to: "2026-07-31",
      usuario: "USU00000002",
      accion: "crear",
      entidad: "cliente",
      q: "CLI",
    },
  },
];

async function exportedWheres(aliasCase: AliasCase, query: Record<string, string>) {
  const search = new URLSearchParams({ ...query, fileFormat: "excel" }).toString();
  const { status, calls } = await runExport(
    aliasCase.report,
    `/api/reports/export/${aliasCase.report}?${search}`,
  );

  expect(status).toBe(200);

  return mainWheres(calls, aliasCase.mainQueries);
}

describe("paridad entre pantalla y exportacion", () => {
  preloadPages(loadRoute, ...REPORTS.map((parityReport) => parityReport.load));

  for (const parityReport of REPORTS) {
    describe(parityReport.report, () => {
      for (const parityCase of parityReport.cases) {
        it(`el enlace de la pantalla exporta el mismo filtro: ${parityCase.name}`, async () => {
          const { status, screen, exported } = await screenAndExport(parityReport, parityCase);

          expect(status).toBe(200);

          const { dateField } = parityReport;

          if (dateField) {
            const dates = (wheres: Record<string, unknown>) =>
              Object.fromEntries(
                Object.entries(wheres).map(([name, where]) => [
                  name,
                  fieldCondition(where, dateField),
                ]),
              );

            expect(dates(exported)).toEqual(dates(screen));
          } else {
            expect(exported).toEqual(screen);
          }
        });
      }
    });
  }

  describe("la exportacion lee solo los parametros que genera la pantalla", () => {
    for (const aliasCase of ALIAS_CASES) {
      it(`${aliasCase.report}: los nombres que ninguna pantalla genera no filtran`, async () => {
        expect(await exportedWheres(aliasCase, aliasCase.retired)).toEqual(
          await exportedWheres(aliasCase, {}),
        );
      });

      it(`${aliasCase.report}: con los dos nombres manda el de la pantalla`, async () => {
        expect(
          await exportedWheres(aliasCase, { ...aliasCase.retired, ...aliasCase.screen }),
        ).toEqual(await exportedWheres(aliasCase, aliasCase.screen));
      });
    }
  });
});

// Entrega 10.2: con el rango invertido, la pantalla no consulta los datos ni
// ofrece exportar, y la ruta rechaza el mismo rango con un 400 sin registrar
// la exportacion. Las 9 pantallas que exportan, con los nombres de fecha de
// su registro.
const EXPORTING_SCREENS: { report: ReportKey; route: string; load: PageLoader }[] = [
  {
    report: "production",
    route: "/dashboard/reports/production",
    load: () => import("@/app/(dashboard)/dashboard/reports/production/page"),
  },
  {
    report: "inventory",
    route: "/dashboard/reports/inventory",
    load: () => import("@/app/(dashboard)/dashboard/reports/inventory/page"),
  },
  {
    report: "sales-collections",
    route: "/dashboard/reports/sales-collections",
    load: () => import("@/app/(dashboard)/dashboard/reports/sales-collections/page"),
  },
  {
    report: "suppliers-purchases",
    route: "/dashboard/reports/suppliers-purchases",
    load: () => import("@/app/(dashboard)/dashboard/reports/suppliers-purchases/page"),
  },
  {
    report: "financial",
    route: "/dashboard/reports/financial",
    load: () => import("@/app/(dashboard)/dashboard/reports/financial/page"),
  },
  {
    report: "maintenance",
    route: "/dashboard/reports/maintenance",
    load: () => import("@/app/(dashboard)/dashboard/reports/maintenance/page"),
  },
  {
    report: "profitability",
    route: "/dashboard/reports/profitability",
    load: () => import("@/app/(dashboard)/dashboard/reports/profitability/page"),
  },
  {
    report: "staff",
    route: "/dashboard/reports/staff",
    load: () => import("@/app/(dashboard)/dashboard/reports/staff/page"),
  },
  {
    report: "audit",
    route: "/dashboard/audit",
    load: () => import("@/app/(dashboard)/dashboard/audit/page"),
  },
];

describe("rango invertido: la pantalla no exporta y la ruta lo rechaza", () => {
  preloadPages(loadRoute, ...EXPORTING_SCREENS.map((screen) => screen.load));

  for (const screen of EXPORTING_SCREENS) {
    it(`${screen.report}: sin enlace de exportar en la pantalla y 400 en la ruta`, async () => {
      const { from, to } = REPORT_REGISTRY[screen.report].dateParams;
      const searchParams = { [from]: "2026-07-31", [to]: "2026-07-01" };
      const page = await characterizePage(
        screen.load,
        { name: "rango invertido", searchParams },
        screen.route,
      );

      expect(page.html).toContain("Corrige el rango de fechas para ver el reporte.");
      expect(page.html).not.toContain("/api/reports/export/");

      const query = new URLSearchParams({ ...searchParams, fileFormat: "excel" }).toString();
      const { status, calls } = await runExport(
        screen.report,
        `/api/reports/export/${screen.report}?${query}`,
      );
      const exportLogged = calls.some(
        (call) => isPrismaCall(call) && call.prisma.startsWith("exportacion_datos."),
      );

      expect(status).toBe(400);
      expect(exportLogged).toBe(false);
    });
  }
});
