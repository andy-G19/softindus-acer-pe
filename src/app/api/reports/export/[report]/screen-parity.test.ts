import { describe, expect, it, vi } from "vitest";

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

function mainWheres(calls: RecordedCall[], mainQueries: string[]) {
  return Object.fromEntries(
    mainQueries.map((name) => {
      const call = calls.find(
        (item): item is PrismaCall => isPrismaCall(item) && item.prisma === name,
      );

      return [name, (call?.args as { where?: unknown } | undefined)?.where];
    }),
  );
}

async function screenAndExport(parityReport: ParityReport, parityCase: ParityCase) {
  const page = await characterizePage(
    parityReport.load,
    { name: parityCase.name, searchParams: parityCase.searchParams },
    parityReport.route,
  );
  const href = exportHref(page.html, parityReport.report);
  const { GET } = await loadRoute();

  mocks.session = {
    user: { id: "USU00000001", name: "Usuario de prueba", role: "ADMIN", status: "activo" },
    expires: "2099-01-01T00:00:00.000Z",
  };

  const { calls, result } = await characterizeHandler(() =>
    GET(new Request(`http://localhost${href}`), {
      params: Promise.resolve({ report: parityReport.report }),
    }),
  );

  return {
    status: result.status,
    screen: mainWheres(page.calls, parityReport.mainQueries),
    exported: mainWheres(calls, parityReport.mainQueries),
  };
}

describe("paridad entre pantalla y exportacion", () => {
  preloadPages(loadRoute, ...REPORTS.map((parityReport) => parityReport.load));

  for (const parityReport of REPORTS) {
    describe(parityReport.report, () => {
      for (const parityCase of parityReport.cases) {
        it(`el enlace de la pantalla exporta el mismo filtro: ${parityCase.name}`, async () => {
          const { status, screen, exported } = await screenAndExport(parityReport, parityCase);

          expect(status).toBe(200);
          expect(exported).toEqual(screen);
        });
      }
    });
  }
});
