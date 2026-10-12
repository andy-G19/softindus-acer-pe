import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";

// Consultas del reporte de Costos y rentabilidad. No autorizan: la pagina
// llama a requireRole y la ruta de exportacion valida el rol del reporte.
//
// La pantalla y la exportacion reciben los mismos filtros, con los nombres
// de la URL de la pantalla, y comparten el constructor del where (grupo 4 de
// fixes): combina las condiciones con AND (D2: con un objeto plano, margen
// bajo y utilidad negativa usaban la misma clave `rentabilidad` y la segunda
// pisaba a la primera) y cierra "hasta" antes del dia siguiente (lt). Cada
// una conserva su limite, su orden y sus columnas.

export type ProfitabilityReportFilters = {
  q: string;
  lowMargin: string;
  negativeProfit: string;
  // Fechas "aaaa-mm-dd" tal como llegan en la URL.
  from: string;
  to: string;
};

function buildCostingWhere(
  filters: ProfitabilityReportFilters,
): Prisma.costeoWhereInput {
  const { q, lowMargin, negativeProfit } = filters;
  const dateRange = buildReportDateRange(filters.from, filters.to);

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

export function getProfitabilityExportRows(
  filters: ProfitabilityReportFilters,
  limit: number,
) {
  return prisma.costeo.findMany({
    where: buildCostingWhere(filters),
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
