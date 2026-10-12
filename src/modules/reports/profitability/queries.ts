import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";

// Consultas del reporte de Costos y rentabilidad. No autorizan: la pagina
// llama a requireRole y la ruta de exportacion valida el rol del reporte.
//
// La pantalla y la exportacion comparten el filtro de costeos y lo combinan
// con AND (grupo 4 de fixes, D2: con un objeto plano, margen bajo y utilidad
// negativa usaban la misma clave `rentabilidad` y la segunda pisaba a la
// primera). Las dos leen las fechas con buildReportDateRange: "hasta" se cierra
// antes del dia siguiente (lt), sin el hueco del ultimo milisegundo. Todavia
// difieren en los parametros (entrega 5): la exportacion acepta alias que la
// pantalla no genera. Igualarlos cambia lo que se exporta: es un fix.

export type ProfitabilityReportFilters = {
  q: string;
  lowMargin: string;
  negativeProfit: string;
  // Fechas "aaaa-mm-dd" tal como llegan en la URL.
  from: string;
  to: string;
};

type CostingFilters = Pick<
  ProfitabilityReportFilters,
  "q" | "lowMargin" | "negativeProfit"
>;

type DateRange = Prisma.costeoWhereInput["fecha_costeo"];

function buildCostingWhere(
  filters: CostingFilters,
  dateRange: DateRange,
): Prisma.costeoWhereInput {
  const { q, lowMargin, negativeProfit } = filters;

  const conditions: Prisma.costeoWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { id_costeo: { contains: q, mode: "insensitive" } },
        { id_pedido: { contains: q, mode: "insensitive" } },
        { id_orden_trabajo: { contains: q, mode: "insensitive" } },
        {
          pedido: {
            cliente: {
              nombre_razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
        {
          orden_trabajo: {
            producto: {
              nombre_producto: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (dateRange) {
    conditions.push({ fecha_costeo: dateRange });
  }

  if (lowMargin === "true") {
    conditions.push({ rentabilidad: { some: { alerta_bajo_margen: true } } });
  }

  if (negativeProfit === "true") {
    conditions.push({ rentabilidad: { some: { utilidad_estimada: { lt: 0 } } } });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export function getProfitabilityReportData(filters: ProfitabilityReportFilters) {
  return prisma.costeo.findMany({
    where: buildCostingWhere(
      filters,
      buildReportDateRange(filters.from, filters.to),
    ),
    orderBy: {
      fecha_costeo: "desc",
    },
    take: 100,
    include: {
      pedido: {
        include: {
          cliente: true,
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
          cliente: true,
        },
      },
      margen_ganancia: {
        orderBy: {
          fecha_aplicacion: "desc",
        },
        take: 1,
      },
      rentabilidad: {
        orderBy: {
          fecha_calculo: "desc",
        },
        take: 1,
      },
    },
  });
}

export type ProfitabilityExportFilters = {
  dateFrom: string;
  dateTo: string;
  searchText: string;
  lowMargin: string;
  negativeProfit: string;
};

export function getProfitabilityExportRows(
  filters: ProfitabilityExportFilters,
  limit: number,
) {
  const { searchText, lowMargin, negativeProfit } = filters;

  return prisma.costeo.findMany({
    where: buildCostingWhere(
      { q: searchText, lowMargin, negativeProfit },
      buildReportDateRange(filters.dateFrom, filters.dateTo),
    ),
    orderBy: [{ fecha_costeo: "desc" }, { id_costeo: "desc" }],
    take: limit,
    include: {
      pedido: {
        include: {
          cliente: true,
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
          cliente: true,
        },
      },
      margen_ganancia: {
        orderBy: {
          fecha_aplicacion: "desc",
        },
        take: 1,
      },
      rentabilidad: {
        orderBy: {
          fecha_calculo: "desc",
        },
        take: 1,
      },
    },
  });
}
