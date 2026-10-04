import "server-only";

import { prisma } from "@/lib/db";
import { findOpenPettyCashBoxes } from "@/modules/petty-cash/boxes/queries";

// Consultas de lectura del formulario de egresos de caja chica. No autorizan:
// la pagina que las llama ya verifico el rol con requireRole.

export async function getNewPettyCashExpenseData() {
  const [openBoxes, activeCategories, latestExpenses] = await Promise.all([
    findOpenPettyCashBoxes(),

    prisma.categoria_gasto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_categoria: "asc",
      },
    }),

    prisma.movimiento_caja.findMany({
      where: {
        tipo_movimiento: "egreso",
      },
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 5,
      include: {
        caja_chica: true,
        categoria_gasto: true,
      },
    }),
  ]);

  return { openBoxes, activeCategories, latestExpenses };
}
