import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de la pagina de Tipos de proveedor. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export async function getSupplierTypeList() {
  return prisma.tipo_proveedor_catalogo.findMany({
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre: "asc",
      },
    ],
    select: {
      id_tipo_proveedor: true,
      nombre: true,
      slug: true,
      descripcion: true,
      estado: true,
    },
  });
}
