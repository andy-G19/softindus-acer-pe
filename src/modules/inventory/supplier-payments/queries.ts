import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";
import { buildDateRangeFilter } from "@/lib/search-params";
import { findPurchaseFilterOptions } from "@/modules/inventory/purchases/queries";
import { findSupplierFilterOptions } from "@/modules/inventory/suppliers/queries";

// Consultas de lectura de la pagina de Pagos a proveedores. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export type SupplierPaymentListFilters = {
  q: string;
  supplier: string;
  purchase: string;
  method: string;
  status: string;
  from: Date | null;
  to: Date | null;
};

function buildSupplierPaymentListConditions(
  filters: SupplierPaymentListFilters,
) {
  const { q, supplier, purchase, method, status, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.pago_proveedorWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { id_compra: { contains: q, mode: "insensitive" } },
        {
          compra: {
            numero_comprobante: { contains: q, mode: "insensitive" },
          },
        },
        {
          compra: {
            proveedor: {
              razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (supplier) {
    conditions.push({ id_proveedor: supplier });
  }

  if (purchase) {
    conditions.push({ id_compra: purchase });
  }

  if (method) {
    conditions.push({ metodo_pago: method });
  }

  if (status) {
    conditions.push({ estado_pago: status });
  }

  if (dateRange) {
    conditions.push({ fecha_pago: dateRange });
  }

  return conditions;
}

// C6 de la 11.2a (hallazgo 5 de la 10.3c): la lista pagina como Compras. El orden termina
// en el id para que dos pagos de la misma fecha no cambien de pagina entre consultas.
export async function getSupplierPaymentListData(
  filters: SupplierPaymentListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const conditions = buildSupplierPaymentListConditions(filters);
  const where: Prisma.pago_proveedorWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [payments, totalItems, suppliers, purchases] = await Promise.all([
    prisma.pago_proveedor.findMany({
      where,
      orderBy: [{ fecha_pago: "desc" }, { id_pago_proveedor: "desc" }],
      skip,
      take,
      include: {
        compra: {
          include: {
            proveedor: true,
          },
        },
      },
    }),
    prisma.pago_proveedor.count({ where }),
    findSupplierFilterOptions(),
    findPurchaseFilterOptions(),
  ]);

  return { payments, totalItems, suppliers, purchases };
}
