import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";
import { buildDateRangeFilter } from "@/lib/search-params";
import { findMaterialFilterOptions } from "@/modules/inventory/materials/queries";
import {
  findActiveSupplierOptions,
  findSupplierFilterOptions,
} from "@/modules/inventory/suppliers/queries";

// Consultas de lectura de las paginas de Compras. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

export type PurchaseListFilters = {
  q: string;
  supplier: string;
  material: string;
  purchaseStatus: string;
  paymentStatus: string;
  from: Date | null;
  to: Date | null;
};

function buildPurchaseListWhere(
  filters: PurchaseListFilters,
): Prisma.compraWhereInput {
  const { q, supplier, material, purchaseStatus, paymentStatus, from, to } =
    filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.compraWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { id_compra: { contains: q, mode: "insensitive" } },
        { numero_comprobante: { contains: q, mode: "insensitive" } },
        {
          proveedor: {
            razon_social: { contains: q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (supplier) {
    conditions.push({ id_proveedor: supplier });
  }

  if (material) {
    conditions.push({
      detalle_compra: {
        some: {
          id_material: material,
        },
      },
    });
  }

  if (purchaseStatus) {
    conditions.push({ estado_compra: purchaseStatus });
  }

  if (paymentStatus) {
    conditions.push({ estado_pago: paymentStatus });
  }

  if (dateRange) {
    conditions.push({ fecha_compra: dateRange });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getPurchaseListData(
  filters: PurchaseListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const where = buildPurchaseListWhere(filters);

  const [purchases, totalItems, suppliers, materials] = await Promise.all([
    prisma.compra.findMany({
      where,
      orderBy: [{ fecha_registro: "desc" }, { id_compra: "desc" }],
      skip,
      take,
      include: {
        proveedor: true,
        pago_proveedor: {
          select: {
            id_pago_proveedor: true,
          },
        },
        movimiento_inventario: {
          select: {
            id_movimiento: true,
          },
        },
      },
    }),
    prisma.compra.count({ where }),
    findSupplierFilterOptions(),
    findMaterialFilterOptions(),
  ]);

  return { purchases, totalItems, suppliers, materials };
}

export async function getNewPurchaseFormOptions() {
  const [suppliers, materials] = await Promise.all([
    findActiveSupplierOptions(),
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        unidad_medida: true,
        costo_unitario_actual: true,
      },
    }),
  ]);

  return { suppliers, materials };
}

// Devuelve null si la compra no existe.
export async function getPurchaseDetail(idCompra: string) {
  const purchase = await prisma.compra.findUnique({
    where: {
      id_compra: idCompra,
    },
  });

  if (!purchase) {
    return null;
  }

  const [supplier, details, payments] = await Promise.all([
    prisma.proveedor.findUnique({
      where: {
        id_proveedor: purchase.id_proveedor,
      },
    }),
    prisma.detalle_compra.findMany({
      where: {
        id_compra: purchase.id_compra,
      },
      orderBy: {
        id_detalle_compra: "asc",
      },
    }),
    prisma.pago_proveedor.findMany({
      where: {
        id_compra: purchase.id_compra,
      },
      orderBy: {
        fecha_pago: "desc",
      },
    }),
  ]);

  const materialIds = details.map((detail) => detail.id_material);

  const materials = await prisma.material.findMany({
    where: {
      id_material: {
        in: materialIds,
      },
    },
  });

  return { purchase, supplier, details, payments, materials };
}

// Opciones de compra que otras funcionalidades usan en sus filtros. Devuelve
// la promesa de Prisma para que el llamador la componga en su Promise.all.
export function findPurchaseFilterOptions() {
  return prisma.compra.findMany({
    orderBy: {
      fecha_compra: "desc",
    },
    select: {
      id_compra: true,
    },
  });
}
