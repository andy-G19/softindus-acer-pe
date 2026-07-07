import { redirect } from "next/navigation";
import { PageHeader } from "@/components/navigation/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleAccessCard } from "@/components/ui/module-access-card";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs } from "@/lib/navigation";

function assertCanViewInventory(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export default async function InventoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  assertCanViewInventory(session.user.role);

  const [materialsCount, suppliersCount, activeAlertsCount, movementsCount] =
    await Promise.all([
      prisma.material.count({
        where: {
          estado: true,
        },
      }),
      prisma.proveedor.count({
        where: {
          estado: true,
        },
      }),
      prisma.alerta_stock.count({
        where: {
          estado_alerta: "activa",
        },
      }),
      prisma.movimiento_inventario.count(),
    ]);

  const modules = [
    {
      title: "Materiales e insumos",
      href: "/dashboard/inventory/materials",
      description:
        "Registra materia prima, consumibles, repuestos, herramientas y stock mínimo.",
    },
    {
      title: "Proveedores",
      href: "/dashboard/inventory/suppliers",
      description:
        "Registra proveedores y prepara la asociación con materiales y compras.",
    },
    {
      title: "Proveedor-material",
      href: "/dashboard/inventory/supplier-materials",
      description: "Asocia proveedores con los materiales que pueden abastecer.",
    },
    {
      title: "Compras",
      href: "/dashboard/inventory/purchases",
      description: "Registra compras y genera entradas automáticas de inventario.",
    },
    {
      title: "Alertas y stock crítico",
      href: "/dashboard/inventory/alerts",
      description: "Consulta materiales críticos y alertas activas de inventario.",
    },
  ];

  return (
    <main className="space-y-8">
      <PageHeader
        title="Inventario"
        description="Controla materiales, insumos, proveedores, compras, movimientos de inventario y alertas de stock bajo."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Inventario" }])}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Materiales activos"
          value={materialsCount.toString()}
          description="Materiales disponibles para uso."
          tone="info"
        />
        <KpiCard
          title="Proveedores activos"
          value={suppliersCount.toString()}
          description="Proveedores habilitados para compras."
          tone="info"
        />
        <KpiCard
          title="Alertas activas"
          value={activeAlertsCount.toString()}
          description="Alertas de stock sin atender."
          tone="warning"
        />
        <KpiCard
          title="Movimientos registrados"
          value={movementsCount.toString()}
          description="Entradas y salidas acumuladas."
          tone="success"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <ModuleAccessCard
            key={module.href}
            title={module.title}
            description={module.description}
            href={module.href}
          />
        ))}
      </section>
    </main>
  );
}
