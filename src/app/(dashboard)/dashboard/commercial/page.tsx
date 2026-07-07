import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleAccessCard } from "@/components/ui/module-access-card";
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
      title: "Clientes activos",
      value: activeClients.toString(),
      description: "Clientes disponibles para pedidos.",
      tone: "info" as const,
    },
    {
      title: "Productos activos",
      value: activeProducts.toString(),
      description: "Productos disponibles para venta.",
      tone: "info" as const,
    },
    {
      title: "Pedidos registrados",
      value: registeredOrders.toString(),
      description: "Pedidos comerciales acumulados.",
      tone: "info" as const,
    },
    {
      title: "Proformas activas",
      value: activeQuotes.toString(),
      description: "Proformas vigentes o aceptadas.",
      tone: "warning" as const,
    },
    {
      title: "Saldo por cobrar",
      value: formatMoney(totalPendingBalance),
      description: "Saldo pendiente en proformas activas.",
      tone: "warning" as const,
    },
    {
      title: "Comprobantes emitidos",
      value: issuedReceipts.toString(),
      description: "Comprobantes internos registrados.",
      tone: "success" as const,
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
          <KpiCard
            key={card.title}
            title={card.title}
            value={card.value}
            description={card.description}
            tone={card.tone}
          />
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Operaciones comerciales
          </h2>
          <p className="text-sm text-muted-foreground">
            Accede rápidamente a las funcionalidades principales del módulo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <ModuleAccessCard
              key={module.href}
              title={module.title}
              description={module.description}
              href={module.href}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
