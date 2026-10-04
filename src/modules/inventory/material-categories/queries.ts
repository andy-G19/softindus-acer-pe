import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de la pagina de Categorias de material. No autorizan:
// la pagina que las llama ya verifico el rol con requireRole.

export async function getMaterialCategoryList() {
  return prisma.categoria_material.findMany({
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre: "asc",
      },
    ],
  });
}
