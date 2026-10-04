import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Consultas de lectura de las paginas de Proveedores. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole.

export type SupplierListFilters = {
  q: string;
  type: string;
  payment: string;
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

function buildSupplierListWhere(
  filters: SupplierListFilters,
): Prisma.proveedorWhereInput {
  const { q, type, payment, status } = filters;
  const statusFilter = getStatusFilter(status);
  const conditions: Prisma.proveedorWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          id_proveedor: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          razon_social: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          numero_documento: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          telefono: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (type) {
    conditions.push({
      tipo_proveedor: type,
    });
  }

  if (payment) {
    conditions.push({
      condicion_pago: payment,
    });
  }

  if (statusFilter !== undefined) {
    conditions.push({
      estado: statusFilter,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getSupplierListData(filters: SupplierListFilters) {
  const where = buildSupplierListWhere(filters);

  const [suppliers, supplierTypes, paymentConditions] = await Promise.all([
    prisma.proveedor.findMany({
      where,
      orderBy: {
        razon_social: "asc",
      },
    }),
    prisma.tipo_proveedor_catalogo.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        nombre: true,
        slug: true,
      },
    }),
    prisma.proveedor.findMany({
      where: {
        condicion_pago: {
          not: null,
        },
      },
      distinct: ["condicion_pago"],
      orderBy: {
        condicion_pago: "asc",
      },
      select: {
        condicion_pago: true,
      },
    }),
  ]);

  return { suppliers, supplierTypes, paymentConditions };
}

export async function getActiveSupplierTypeOptions() {
  return prisma.tipo_proveedor_catalogo.findMany({
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

// Devuelve null si el proveedor no existe; los tipos incluyen el actual del
// proveedor aunque este inactivo.
export async function getSupplierEditData(idProveedor: string) {
  const supplier = await prisma.proveedor.findUnique({
    where: {
      id_proveedor: idProveedor,
    },
  });

  if (!supplier) {
    return null;
  }

  const supplierTypes = await prisma.tipo_proveedor_catalogo.findMany({
    where: {
      OR: [
        {
          estado: true,
        },
        {
          slug: supplier.tipo_proveedor,
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

  return { supplier, supplierTypes };
}

// Opciones de proveedor que otras funcionalidades usan en sus filtros y
// formularios. Devuelven la promesa de Prisma para que el llamador la componga
// en su Promise.all.
export function findSupplierFilterOptions() {
  return prisma.proveedor.findMany({
    orderBy: {
      razon_social: "asc",
    },
    select: {
      id_proveedor: true,
      razon_social: true,
    },
  });
}

export function findActiveSupplierOptions() {
  return prisma.proveedor.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      razon_social: "asc",
    },
    select: {
      id_proveedor: true,
      razon_social: true,
    },
  });
}
