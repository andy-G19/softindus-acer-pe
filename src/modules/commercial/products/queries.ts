import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";

// Consultas de lectura de las paginas de Productos y Categorias de producto.
// No autorizan: la pagina que las llama ya verifico el rol con requireRole.

export type ProductListFilters = {
  q: string;
  category: string;
  unit: string;
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

function buildProductListWhere(
  filters: ProductListFilters,
): Prisma.productoWhereInput {
  const { q, category, unit, status } = filters;
  const statusFilter = getStatusFilter(status);
  const conditions: Prisma.productoWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          id_producto: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_producto: {
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

export async function getProductListData(
  filters: ProductListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const where = buildProductListWhere(filters);

  const [products, totalItems, categories, units] = await Promise.all([
    prisma.producto.findMany({
      where,
      orderBy: [{ fecha_registro: "desc" }, { id_producto: "desc" }],
      skip,
      take,
      select: {
        id_producto: true,
        nombre_producto: true,
        categoria: true,
        unidad_medida: true,
        precio_referencial: true,
        estado: true,
      },
    }),
    prisma.producto.count({ where }),
    prisma.categoria_producto.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        nombre: true,
        slug: true,
      },
    }),
    prisma.producto.findMany({
      distinct: ["unidad_medida"],
      orderBy: {
        unidad_medida: "asc",
      },
      select: {
        unidad_medida: true,
      },
    }),
  ]);

  return { products, totalItems, categories, units };
}

export async function getActiveProductCategoryOptions() {
  return prisma.categoria_producto.findMany({
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

// Devuelve null si el producto no existe; las categorias incluyen la actual
// del producto aunque este inactiva.
export async function getProductEditData(idProducto: string) {
  const product = await prisma.producto.findUnique({
    where: {
      id_producto: idProducto,
    },
    select: {
      id_producto: true,
      nombre_producto: true,
      categoria: true,
      descripcion: true,
      unidad_medida: true,
      precio_referencial: true,
    },
  });

  if (!product) {
    return null;
  }

  const categories = await prisma.categoria_producto.findMany({
    where: {
      OR: [
        {
          estado: true,
        },
        {
          slug: product.categoria,
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

  return { product, categories };
}

export async function getProductCategoryList() {
  return prisma.categoria_producto.findMany({
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre: "asc",
      },
    ],
    select: {
      id_categoria_producto: true,
      nombre: true,
      slug: true,
      descripcion: true,
      estado: true,
    },
  });
}

// Opciones de producto que otras funcionalidades usan en sus filtros y
// formularios. Devuelven la promesa de Prisma para que el llamador la componga
// en su Promise.all.
export function findProductFilterOptions() {
  return prisma.producto.findMany({
    orderBy: {
      nombre_producto: "asc",
    },
    select: {
      id_producto: true,
      nombre_producto: true,
    },
  });
}

export function findActiveProductOptions() {
  return prisma.producto.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      nombre_producto: "asc",
    },
    select: {
      id_producto: true,
      nombre_producto: true,
      categoria: true,
      unidad_medida: true,
      precio_referencial: true,
    },
  });
}

// Productos activos por nombre, para los filtros de Produccion.
export function findActiveProductFilterOptions() {
  return prisma.producto.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      nombre_producto: "asc",
    },
    select: {
      id_producto: true,
      nombre_producto: true,
    },
  });
}

// Productos activos por categoria y nombre, para los formularios de rutas.
export function findActiveProductsByCategory() {
  return prisma.producto.findMany({
    where: {
      estado: true,
    },
    orderBy: [
      {
        categoria: "asc",
      },
      {
        nombre_producto: "asc",
      },
    ],
    select: {
      id_producto: true,
      nombre_producto: true,
      categoria: true,
      unidad_medida: true,
    },
  });
}
