import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Consultas de lectura de las paginas de Categorias de gasto. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export type ExpenseCategoryListFilters = {
  q: string;
  status: string;
};

function getStatusFilter(status: string) {
  if (status === "active") {
    return true;
  }

  if (status === "inactive") {
    return false;
  }

  return undefined;
}

function buildExpenseCategoryListWhere(
  filters: ExpenseCategoryListFilters,
): Prisma.categoria_gastoWhereInput {
  const { q, status } = filters;
  const statusFilter = getStatusFilter(status);
  const conditions: Prisma.categoria_gastoWhereInput[] = [];

  if (q) {
    conditions.push({
      nombre_categoria: {
        contains: q,
        mode: "insensitive",
      },
    });
  }

  if (statusFilter !== undefined) {
    conditions.push({
      estado: statusFilter,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getExpenseCategoryList(filters: ExpenseCategoryListFilters) {
  const where = buildExpenseCategoryListWhere(filters);

  return prisma.categoria_gasto.findMany({
    where,
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre_categoria: "asc",
      },
    ],
    select: {
      id_categoria_gasto: true,
      nombre_categoria: true,
      descripcion: true,
      estado: true,
    },
  });
}

export async function getExpenseCategoryForEdit(idCategoriaGasto: string) {
  return prisma.categoria_gasto.findUnique({
    where: {
      id_categoria_gasto: idCategoriaGasto,
    },
  });
}
