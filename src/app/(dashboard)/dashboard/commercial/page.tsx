import Link from "next/link";

import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/formatters";
import { dashboardBreadcrumbs } from "@/lib/navigation";

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
      <PageHeader
        title="Comercial"
        description="Gestiona clientes, productos, pedidos, proformas, pagos y comprobantes."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Comercial" }])}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border/80 bg-card p-5 shadow-sm transition-colors hover:bg-secondary/70"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {card.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
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

        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-xl border border-border/80 bg-card p-6 shadow-sm transition-colors hover:bg-secondary/70"
            >
              <h3 className="text-xl font-semibold text-foreground">
                {module.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {module.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
