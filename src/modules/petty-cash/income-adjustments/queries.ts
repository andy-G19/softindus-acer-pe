import "server-only";

import { prisma } from "@/lib/db";
import { findOpenPettyCashBoxes } from "@/modules/petty-cash/boxes/queries";

// Consultas de lectura del formulario de ingresos y ajustes de caja chica. No
// autorizan: la pagina que las llama ya verifico el rol con requireRole.

export async function getNewPettyCashIncomeAdjustmentData() {
  const [openBoxes, latestMovements] = await Promise.all([
    findOpenPettyCashBoxes(),

    prisma.movimiento_caja.findMany({
      where: {
        tipo_movimiento: {
          in: ["ingreso", "ajuste"],
        },
      },
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 6,
      include: {
        caja_chica: true,
      },
    }),
  ]);

  return { openBoxes, latestMovements };
}
