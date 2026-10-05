import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de cajas chicas. No autorizan: la pagina que las llama
// ya verifico el rol con requireRole.

export async function getPettyCashBoxList() {
  return prisma.caja_chica.findMany({
    orderBy: [
      {
        estado: "asc",
      },
      {
        fecha_apertura: "desc",
      },
    ],
    include: {
      _count: {
        select: {
          movimiento_caja: true,
        },
      },
    },
  });
}

// Cajas abiertas por nombre, para los formularios de egresos, ingresos y
// ajustes y para el resumen mensual. Devuelve la promesa de Prisma.
export function findOpenPettyCashBoxes() {
  return prisma.caja_chica.findMany({
    where: {
      estado: "abierta",
    },
    orderBy: {
      nombre_caja: "asc",
    },
    select: {
      id_caja_chica: true,
      nombre_caja: true,
      saldo_actual: true,
    },
  });
}
