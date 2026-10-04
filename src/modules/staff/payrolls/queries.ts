import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas de lectura de las paginas de Planillas. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole.

export type PayrollListFilters = {
  q: string;
  operario: string;
  periodo: string;
  modalidad: string;
  estado: string;
  from: Date | null;
  to: Date | null;
};

function buildPayrollListWhere(
  filters: PayrollListFilters,
): Prisma.planilla_pagoWhereInput {
  const { q, operario, periodo, modalidad, estado, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.planilla_pagoWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { id_planilla: { contains: q, mode: "insensitive" } },
        {
          operario: {
            nombres: { contains: q, mode: "insensitive" },
          },
        },
        {
          operario: {
            apellidos: { contains: q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (operario) {
    conditions.push({
      id_operario: { contains: operario, mode: "insensitive" },
    });
  }

  if (periodo) {
    const match = /^(\d{4})-(\d{2})$/.exec(periodo);

    if (match) {
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0);

      conditions.push({
        periodo_inicio: { gte: start },
        periodo_fin: { lte: end },
      });
    }
  }

  if (modalidad) {
    conditions.push({ modalidad_pago: modalidad });
  }

  if (estado) {
    conditions.push({ estado_pago: estado });
  }

  if (dateRange) {
    conditions.push({ fecha_generacion: dateRange });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getPayrollListData(filters: PayrollListFilters) {
  const where = buildPayrollListWhere(filters);

  const [
    totalPayrolls,
    pendingPayrolls,
    paidPayrolls,
    canceledPayrolls,
    pendingNetAmount,
    latestPayrolls,
  ] = await Promise.all([
    prisma.planilla_pago.count({ where }),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "pendiente",
      },
    }),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "pagado",
      },
    }),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "anulada",
      },
    }),

    prisma.planilla_pago.aggregate({
      where: {
        estado_pago: "pendiente",
      },
      _sum: {
        monto_neto: true,
      },
    }),

    prisma.planilla_pago.findMany({
      where,
      orderBy: [
        {
          fecha_generacion: "desc",
        },
        {
          id_planilla: "desc",
        },
      ],
      take: 50,
      include: {
        operario: true,
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        _count: {
          select: {
            historial_pago_operario: true,
          },
        },
      },
    }),
  ]);

  return {
    totalPayrolls,
    pendingPayrolls,
    paidPayrolls,
    canceledPayrolls,
    pendingNetAmount,
    latestPayrolls,
  };
}

export async function getPayrollFormOperators() {
  return prisma.operario.findMany({
    where: {
      estado: "activo",
    },
    orderBy: [
      {
        apellidos: "asc",
      },
      {
        nombres: "asc",
      },
    ],
    include: {
      _count: {
        select: {
          asistencia: true,
          planilla_pago: true,
        },
      },
    },
  });
}
