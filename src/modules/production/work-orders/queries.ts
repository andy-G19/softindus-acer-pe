import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de ordenes de trabajo que usan otras areas. Las paginas
// de ordenes de trabajo se migran en la entrega 6.

// Las 50 ordenes no anuladas mas recientes, con producto y cliente, para los
// formularios de chatarra y retazos. Devuelve la promesa de Prisma.
export function findRecentWorkOrderOptions() {
  return prisma.orden_trabajo.findMany({
    where: {
      estado: {
        not: "anulada",
      },
    },
    orderBy: {
      fecha_registro: "desc",
    },
    take: 50,
    include: {
      producto: true,
      cliente: true,
    },
  });
}
