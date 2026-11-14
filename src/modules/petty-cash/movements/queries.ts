import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas de lectura de la pagina de Movimientos de caja chica. No
// autorizan: la pagina que las llama ya verifico el rol con requireRole.

export type PettyCashMovementFilters = {
  cashBox: string;
  type: string;
  category: string;
  /** Fechas ya interpretadas por parseDateParam; null no filtra. */
  startDate: Date | null;
  endDate: Date | null;
  searchText: string;
};

function buildPettyCashMovementWhere(filters: PettyCashMovementFilters) {
  const { cashBox, type, category, startDate, endDate, searchText } = filters;
  const where: Prisma.movimiento_cajaWhereInput = {};

  if (cashBox) {
    where.id_caja_chica = cashBox;
  }

  if (type) {
    where.tipo_movimiento = type;
  }

  if (category) {
    where.id_categoria_gasto = category;
  }

  // C6 de la 11.4b (D51): la regla de los demas listados, desde el inicio del primer dia hasta
  // antes del dia siguiente al ultimo. La copia local cortaba a las T23:59:59 en punto y dejaba
  // fuera lo registrado despues, dentro de ese segundo (timestamptz guarda microsegundos).
  const dateRange = buildDateRangeFilter(startDate, endDate);

  if (dateRange) {
    where.fecha_movimiento = dateRange;
  }

  if (searchText) {
    where.OR = [
      {
        concepto: {
          contains: searchText,
          mode: "insensitive",
        },
      },
      {
        comprobante: {
          contains: searchText,
          mode: "insensitive",
        },
      },
      {
        responsable: {
          contains: searchText,
          mode: "insensitive",
        },
      },
      {
        observaciones: {
          contains: searchText,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
}

export async function getPettyCashMovementListData(
  filters: PettyCashMovementFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const where = buildPettyCashMovementWhere(filters);

  const [
    cashBoxes,
    categories,
    movements,
    totalMatches,
    incomeSum,
    expenseSum,
    positiveAdjustmentSum,
    negativeAdjustmentSum,
  ] = await Promise.all([
    prisma.caja_chica.findMany({
      orderBy: {
        nombre_caja: "asc",
      },
      select: {
        id_caja_chica: true,
        nombre_caja: true,
      },
    }),

    prisma.categoria_gasto.findMany({
      orderBy: {
        nombre_categoria: "asc",
      },
      select: {
        id_categoria_gasto: true,
        nombre_categoria: true,
      },
    }),

    prisma.movimiento_caja.findMany({
      where,
      orderBy: [
        {
          fecha_movimiento: "desc",
        },
        {
          id_movimiento_caja: "desc",
        },
      ],
      skip,
      take,
      include: {
        caja_chica: true,
        categoria_gasto: true,
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        // C5 de la 11.4b (D50): la venta de chatarra que genero el movimiento, para no ofrecer
        // anular su ingreso (la accion lo rechaza, D45).
        venta_chatarra: {
          select: { id_venta_chatarra: true },
          orderBy: { id_venta_chatarra: "asc" },
        },
      },
    }),

    prisma.movimiento_caja.count({
      where,
    }),

    // Los totales de las KPI se calculan con aggregate sobre TODO el
    // conjunto filtrado (no solo la pagina actual), para que sigan siendo
    // correctos ahora que la tabla esta paginada.
    prisma.movimiento_caja.aggregate({
      where: { AND: [where, { tipo_movimiento: "ingreso" }] },
      _sum: { monto: true },
    }),
    prisma.movimiento_caja.aggregate({
      where: { AND: [where, { tipo_movimiento: "egreso" }] },
      _sum: { monto: true },
    }),
    prisma.movimiento_caja.aggregate({
      where: {
        AND: [
          where,
          { tipo_movimiento: "ajuste" },
          { concepto: { startsWith: "Ajuste positivo" } },
        ],
      },
      _sum: { monto: true },
    }),
    prisma.movimiento_caja.aggregate({
      where: {
        AND: [
          where,
          { tipo_movimiento: "ajuste" },
          { concepto: { startsWith: "Ajuste negativo" } },
        ],
      },
      _sum: { monto: true },
    }),
  ]);

  return {
    cashBoxes,
    categories,
    movements,
    totalMatches,
    incomeSum,
    expenseSum,
    positiveAdjustmentSum,
    negativeAdjustmentSum,
  };
}
