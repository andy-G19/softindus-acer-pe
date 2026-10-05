import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura del formulario de venta de chatarra. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export async function getNewScrapSaleFormOptions() {
  const [scraps, cashBoxes] = await Promise.all([
    prisma.chatarra.findMany({
      where: {
        estado: {
          in: ["acumulada", "disponible"],
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        material: true,
      },
    }),

    prisma.caja_chica.findMany({
      where: {
        estado: "abierta",
      },
      orderBy: {
        fecha_apertura: "desc",
      },
      select: {
        id_caja_chica: true,
        nombre_caja: true,
        saldo_actual: true,
        responsable: true,
      },
    }),
  ]);

  return { scraps, cashBoxes };
}
