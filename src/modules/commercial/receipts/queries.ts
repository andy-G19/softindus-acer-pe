import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas de lectura de la pagina de Comprobantes. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole.

export type ReceiptListFilters = {
  q: string;
  type: string;
  status: string;
  from: Date | null;
  to: Date | null;
};

function buildReceiptListConditions(filters: ReceiptListFilters) {
  const { q, type, status, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.comprobante_ventaWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { numero_comprobante: { contains: q, mode: "insensitive" } },
        { id_pedido: { contains: q, mode: "insensitive" } },
        {
          pedido: {
            cliente: {
              nombre_razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (type) {
    conditions.push({ tipo_comprobante: type });
  }

  if (status) {
    conditions.push({ estado: status });
  }

  if (dateRange) {
    conditions.push({ fecha_emision: dateRange });
  }

  return conditions;
}

// C3 de la 11.3c (D39): solo las columnas que muestra la tabla. Antes traia el cliente y la
// proforma completos; el enlace a la proforma usa el id que ya guarda el comprobante.
export async function getReceiptList(filters: ReceiptListFilters) {
  const conditions = buildReceiptListConditions(filters);

  return prisma.comprobante_venta.findMany({
    where: conditions.length > 0 ? { AND: conditions } : {},
    orderBy: {
      fecha_emision: "desc",
    },
    select: {
      id_comprobante: true,
      numero_comprobante: true,
      id_pedido: true,
      id_proforma: true,
      tipo_comprobante: true,
      fecha_emision: true,
      monto_total: true,
      estado: true,
      pedido: {
        select: {
          cliente: {
            select: {
              nombre_razon_social: true,
            },
          },
        },
      },
    },
  });
}
