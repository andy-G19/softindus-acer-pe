import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";

// Consultas de lectura de las paginas de Materiales. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole.

export type MaterialListFilters = {
  q: string;
  category: string;
  unit: string;
  status: string;
  stock: string;
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

function isCriticalStock(material: {
  stock_actual: unknown;
  stock_reservado: unknown;
  stock_minimo: unknown;
}) {
  const stockActual = Number(String(material.stock_actual));
  const stockReservado = Number(String(material.stock_reservado));
  const stockMinimo = Number(String(material.stock_minimo));
  const stockDisponible = stockActual - stockReservado;

  return stockMinimo > 0 && stockDisponible <= stockMinimo;
}

function buildMaterialListWhere(
  filters: MaterialListFilters,
): Prisma.materialWhereInput {
  const { q, category, unit, status } = filters;
  const statusFilter = getStatusFilter(status);
  const conditions: Prisma.materialWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          id_material: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_material: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (category) {
    conditions.push({
      categoria: category,
    });
  }

  if (unit) {
    conditions.push({
      unidad_medida: unit,
    });
  }

  if (statusFilter !== undefined) {
    conditions.push({
      estado: statusFilter,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getMaterialListData(
  filters: MaterialListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const { stock } = filters;
  const where = buildMaterialListWhere(filters);

  const [materialsQuery, categories, units] = await Promise.all([
    // El filtro "stock" compara stock_actual - stock_reservado contra
    // stock_minimo (tres columnas entre si): Prisma no puede expresar eso en
    // un `where`. Cuando ese filtro esta activo, se resuelve y se pagina en
    // memoria sobre el conjunto ya acotado por el resto de filtros (q,
    // categoria, unidad, estado); en el caso normal (sin filtro de stock) la
    // paginacion es 100% a nivel de base de datos con skip/take/count.
    stock === "critical" || stock === "ok"
      ? prisma.material
          .findMany({
            where,
            orderBy: [{ fecha_registro: "desc" }, { id_material: "desc" }],
            select: {
              id_material: true,
              nombre_material: true,
              categoria: true,
              unidad_medida: true,
              costo_unitario_actual: true,
              stock_actual: true,
              stock_reservado: true,
              stock_minimo: true,
              estado: true,
            },
          })
          .then((allMatching) => {
            const filtered = allMatching.filter((material) => {
              const isCritical = isCriticalStock(material);
              return stock === "critical" ? isCritical : !isCritical;
            });

            return {
              materials: filtered.slice(skip, skip + take),
              totalItems: filtered.length,
            };
          })
      : Promise.all([
          prisma.material.findMany({
            where,
            orderBy: [{ fecha_registro: "desc" }, { id_material: "desc" }],
            skip,
            take,
            select: {
              id_material: true,
              nombre_material: true,
              categoria: true,
              unidad_medida: true,
              costo_unitario_actual: true,
              stock_actual: true,
              stock_reservado: true,
              stock_minimo: true,
              estado: true,
            },
          }),
          prisma.material.count({ where }),
        ]).then(([materials, totalItems]) => ({ materials, totalItems })),
    prisma.categoria_material.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        nombre: true,
        slug: true,
      },
    }),
    prisma.material.findMany({
      distinct: ["unidad_medida"],
      orderBy: {
        unidad_medida: "asc",
      },
      select: {
        unidad_medida: true,
      },
    }),
  ]);

  return { ...materialsQuery, categories, units };
}

export async function getActiveMaterialCategoryOptions() {
  return prisma.categoria_material.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      nombre: "asc",
    },
    select: {
      nombre: true,
      slug: true,
    },
  });
}

// Devuelve null si el material no existe; las categorias incluyen la actual
// del material aunque este inactiva.
export async function getMaterialEditData(idMaterial: string) {
  const material = await prisma.material.findUnique({
    where: {
      id_material: idMaterial,
    },
  });

  if (!material) {
    return null;
  }

  const categories = await prisma.categoria_material.findMany({
    where: {
      OR: [
        {
          estado: true,
        },
        {
          slug: material.categoria,
        },
      ],
    },
    orderBy: {
      nombre: "asc",
    },
    select: {
      nombre: true,
      slug: true,
    },
  });

  return { material, categories };
}

// Opciones de material que otras funcionalidades usan en sus filtros.
// Devuelve la promesa de Prisma para que el llamador la componga en su
// Promise.all.
export function findMaterialFilterOptions() {
  return prisma.material.findMany({
    orderBy: {
      nombre_material: "asc",
    },
    select: {
      id_material: true,
      nombre_material: true,
    },
  });
}
