import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  findActiveSupplierOptions,
  findSupplierFilterOptions,
  getActiveSupplierTypeOptions,
} from "@/modules/inventory/suppliers/queries";

// Consultas de lectura de las paginas de Repuestos. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole. Los proveedores y sus
// tipos se consultan a traves de la interfaz publica de Proveedores.

export type SparePartListFilters = {
  q: string;
  provider: string;
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

function buildSparePartListWhere(
  filters: SparePartListFilters,
): Prisma.repuestoWhereInput {
  const { q, provider, status } = filters;
  const statusFilter = getStatusFilter(status);
  const conditions: Prisma.repuestoWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          id_repuesto: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_repuesto: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (provider) {
    conditions.push({
      id_proveedor: provider,
    });
  }

  if (statusFilter !== undefined) {
    conditions.push({
      estado: statusFilter,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getSparePartListData(filters: SparePartListFilters) {
  const where = buildSparePartListWhere(filters);

  const [spareParts, providers] = await Promise.all([
    prisma.repuesto.findMany({
      where,
      orderBy: [
        {
          estado: "desc",
        },
        {
          nombre_repuesto: "asc",
        },
      ],
      include: {
        proveedor: true,
        _count: {
          select: {
            detalle_repuesto_reparacion: true,
          },
        },
      },
    }),
    findSupplierFilterOptions(),
  ]);

  return { spareParts, providers };
}

export async function getNewSparePartFormOptions() {
  const [providers, supplierTypes] = await Promise.all([
    findActiveSupplierOptions(),
    getActiveSupplierTypeOptions(),
  ]);

  return { providers, supplierTypes };
}

// Devuelve null si el repuesto no existe; los proveedores incluyen el actual
// del repuesto aunque este inactivo.
export async function getSparePartEditData(idRepuesto: string) {
  const sparePart = await prisma.repuesto.findUnique({
    where: {
      id_repuesto: idRepuesto,
    },
  });

  if (!sparePart) {
    return null;
  }

  const [providers, supplierTypes] = await Promise.all([
    prisma.proveedor.findMany({
      where: {
        OR: [
          {
            estado: true,
          },
          ...(sparePart.id_proveedor
            ? [
                {
                  id_proveedor: sparePart.id_proveedor,
                },
              ]
            : []),
        ],
      },
      orderBy: {
        razon_social: "asc",
      },
      select: {
        id_proveedor: true,
        razon_social: true,
      },
    }),
    getActiveSupplierTypeOptions(),
  ]);

  return { sparePart, providers, supplierTypes };
}
