import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de la pagina de Fallas. No autorizan: la pagina que las
// llama ya verifico el rol con requireRole.

export async function getFailureList() {
  return prisma.falla_maquina.findMany({
    orderBy: {
      fecha_falla: "desc",
    },
    include: {
      maquina: true,
      _count: {
        select: {
          reparacion: true,
        },
      },
    },
  });
}
