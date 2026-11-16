import "server-only";

import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";

// Consultas de lectura de las paginas de Historial de pagos. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

// today es el instante de referencia de la pagina para los totales del mes.
export async function getOperatorPaymentHistoryData(
  today: Date,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    totalPayments,
    paymentsThisMonth,
    totalPaidAmount,
    monthlyPaidAmount,
    latestPayments,
  ] = await Promise.all([
    prisma.historial_pago_operario.count(),

    prisma.historial_pago_operario.count({
      where: {
        fecha_pago: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.historial_pago_operario.aggregate({
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.historial_pago_operario.aggregate({
      where: {
        fecha_pago: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.historial_pago_operario.findMany({
      orderBy: [
        {
          fecha_pago: "desc",
        },
        {
          id_historial_pago: "desc",
        },
      ],
      // C9 de la 11.5 (D61): paginado; el historial cortaba en 50 pagos. fecha_pago es @db.Date:
      // el orden termina en el id para que sea total y OFFSET no repita ni salte filas.
      skip,
      take,
      include: {
        planilla_pago: {
          include: {
            operario: true,
          },
        },
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
    }),
  ]);

  return {
    totalPayments,
    paymentsThisMonth,
    totalPaidAmount,
    monthlyPaidAmount,
    latestPayments,
  };
}

export async function getPendingPayrolls() {
  return prisma.planilla_pago.findMany({
    where: {
      estado_pago: "pendiente",
    },
    orderBy: [
      {
        fecha_generacion: "desc",
      },
      {
        id_planilla: "desc",
      },
    ],
    include: {
      operario: true,
    },
  });
}
