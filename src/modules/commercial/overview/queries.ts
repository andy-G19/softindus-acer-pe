import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura del panel de Comercial. No autorizan: la pagina que las
// llama ya verifico el rol con requireRole.

export async function getCommercialOverviewData() {
  const [
    activeClients,
    activeProducts,
    registeredOrders,
    activeQuotes,
    issuedReceipts,
    pendingQuotes,
  ] = await Promise.all([
    prisma.cliente.count({
      where: {
        estado: true,
      },
    }),

    prisma.producto.count({
      where: {
        estado: true,
      },
    }),

    prisma.pedido.count(),

    prisma.proforma.count({
      where: {
        estado: {
          in: ["vigente", "aceptada"],
        },
      },
    }),

    prisma.comprobante_venta.count({
      where: {
        estado: "emitido",
      },
    }),

    prisma.proforma.findMany({
      where: {
        estado: {
          in: ["vigente", "aceptada"],
        },
      },
      select: {
        saldo: true,
      },
    }),
  ]);

  return {
    activeClients,
    activeProducts,
    registeredOrders,
    activeQuotes,
    issuedReceipts,
    pendingQuotes,
  };
}
