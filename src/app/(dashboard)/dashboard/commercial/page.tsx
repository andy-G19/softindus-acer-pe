import Link from "next/link";

import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/formatters";

export default async function CommercialPage() {
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

  const totalPendingBalance = pendingQuotes.reduce((total, quote) => {
    return total + Number(quote.saldo.toString());
  }, 0);

  const summaryCards = [
    {
      label: "Clientes activos",
      value: activeClients,
      description: "Clientes disponibles para pedidos.",
    },
    {
      label: "Productos activos",
      value: activeProducts,
      description: "Productos disponibles para venta.",
    },
    {
      label: "Pedidos registrados",
      value: registeredOrders,
      description: "Pedidos comerciales acumulados.",
    },
    {
      label: "Proformas activas",
      value: activeQuotes,
      description: "Proformas vigentes o aceptadas.",
    },
    {
      label: "Saldo por cobrar",
      value: formatMoney(totalPendingBalance),
      description: "Saldo pendiente en proformas activas.",
    },
    {
      label: "Comprobantes emitidos",
      value: issuedReceipts,
      description: "Comprobantes internos registrados.",
    },
  ];

  const modules = [
    {
      title: "Clientes",
      href: "/dashboard/commercial/clients",
      description: "Registrar y consultar clientes del taller.",
    },
    {
      title: "Productos",
      href: "/dashboard/commercial/products",
      description: "Registrar y consultar productos comerciales o fabricados.",
    },
    {
      title: "Pedidos",
      href: "/dashboard/commercial/orders",
      description: "Registrar pedidos de clientes y su detalle comercial.",
    },
    {
      title: "Proformas",
      href: "/dashboard/commercial/quotes",
      description: "Generar y consultar proformas digitales desde pedidos.",
    },
  ];

  return (
    <main className="space-y-8">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold">Módulo Comercial</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de clientes, productos, pedidos, proformas, pagos y
          comprobantes.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-lg border p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Operaciones comerciales</h2>
          <p className="text-sm text-muted-foreground">
            Accede rápidamente a las funcionalidades principales del módulo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-lg border p-5 transition hover:bg-muted"
            >
              <h3 className="font-semibold">{module.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {module.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}