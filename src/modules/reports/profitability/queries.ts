import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas del reporte de Costos y rentabilidad. No autorizan: la pagina
// llama a requireRole y la ruta de exportacion valida el rol del reporte.
//
// La pantalla y la exportacion filtran los costeos con reglas distintas
// (entrega 5): la pantalla combina condiciones con AND, lee las fechas con
// parseDateParam y cierra "hasta" al final del dia (lte); la exportacion usa
// un objeto plano, acepta alias de parametros y cierra "hasta" antes del dia
// siguiente (lt). Ademas, con lowMargin y negativeProfit a la vez, la segunda
// condicion de la exportacion reemplaza la clave `rentabilidad` y se ignora
// el margen bajo. Igualarlas cambia lo que se ve o se exporta: es un fix.

export type ProfitabilityReportFilters = {
  q: string;
  lowMargin: string;
  negativeProfit: string;
  from: Date | null;
  to: Date | null;
};

function buildCostingWhere(
  filters: ProfitabilityReportFilters,
): Prisma.costeoWhereInput {
  const { q, lowMargin, negativeProfit } = filters;
  const dateRange = buildDateRangeFilter(filters.from, filters.to);

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
    where: buildCostingWhere(filters),
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
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);

  return prisma.costeo.findMany({
    where: {
      ...(dateRange ? { fecha_costeo: dateRange } : {}),
      ...(searchText
        ? {
            OR: [
              { id_costeo: { contains: searchText, mode: "insensitive" } },
              { id_pedido: { contains: searchText, mode: "insensitive" } },
              { id_orden_trabajo: { contains: searchText, mode: "insensitive" } },
              {
                pedido: {
                  cliente: {
                    nombre_razon_social: {
                      contains: searchText,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                orden_trabajo: {
                  producto: {
                    nombre_producto: {
                      contains: searchText,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(lowMargin === "true"
        ? { rentabilidad: { some: { alerta_bajo_margen: true } } }
        : {}),
      ...(negativeProfit === "true"
        ? { rentabilidad: { some: { utilidad_estimada: { lt: 0 } } } }
        : {}),
    },
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
