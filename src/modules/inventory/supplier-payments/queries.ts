import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
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

export async function getSupplierPaymentListData(
  filters: SupplierPaymentListFilters,
) {
  const conditions = buildSupplierPaymentListConditions(filters);

  const [payments, suppliers, purchases] = await Promise.all([
    prisma.pago_proveedor.findMany({
      where: conditions.length > 0 ? { AND: conditions } : {},
      orderBy: {
        fecha_pago: "desc",
      },
      include: {
        compra: {
          include: {
            proveedor: true,
          },
        },
        usuario: true,
      },
    }),
    findSupplierFilterOptions(),
    findPurchaseFilterOptions(),
  ]);

  return { payments, suppliers, purchases };
}
