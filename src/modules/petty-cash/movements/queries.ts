import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";

// Consultas de lectura de la pagina de Movimientos de caja chica. No
// autorizan: la pagina que las llama ya verifico el rol con requireRole.

export type PettyCashMovementFilters = {
  cashBox: string;
  type: string;
  category: string;
  startDate: string;
  endDate: string;
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

  if (startDate || endDate) {
    where.fecha_movimiento = {
      ...(startDate
        ? {
            gte: new Date(`${startDate}T00:00:00`),
          }
        : {}),
      ...(endDate
        ? {
            lte: new Date(`${endDate}T23:59:59`),
          }
        : {}),
    };
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
