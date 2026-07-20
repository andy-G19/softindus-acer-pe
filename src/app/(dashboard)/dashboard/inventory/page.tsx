/**
 * Ubicación destino: src/app/(dashboard)/dashboard/inventory/page.tsx
 * (reemplaza el archivo actual)
 */
import {
  AlertTriangle,
  ArrowLeftRight,
  Link2,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";

import { PageHeader } from "@/components/navigation/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleAccessCard } from "@/components/ui/module-access-card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs } from "@/lib/navigation";

export default async function InventoryPage() {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
      icon: Package,
      tone: "chart-1" as const,
    },
    {
      title: "Proveedores",
      href: "/dashboard/inventory/suppliers",
      description:
        "Registra proveedores y prepara la asociación con materiales y compras.",
      icon: Truck,
      tone: "chart-2" as const,
    },
    {
      title: "Proveedor-material",
      href: "/dashboard/inventory/supplier-materials",
      description: "Asocia proveedores con los materiales que pueden abastecer.",
      icon: Link2,
      tone: "chart-3" as const,
    },
    {
      title: "Compras",
      href: "/dashboard/inventory/purchases",
      description: "Registra compras y genera entradas automáticas de inventario.",
      icon: ShoppingCart,
      tone: "chart-4" as const,
    },
    {
      title: "Alertas y stock crítico",
      href: "/dashboard/inventory/alerts",
      description: "Consulta materiales críticos y alertas activas de inventario.",
      icon: AlertTriangle,
      tone: "chart-5" as const,
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
          icon={Package}
        />
        <KpiCard
          title="Proveedores activos"
          value={suppliersCount.toString()}
          description="Proveedores habilitados para compras."
          tone="info"
          icon={Truck}
        />
        <KpiCard
          title="Alertas activas"
          value={activeAlertsCount.toString()}
          description="Alertas de stock sin atender."
          tone="warning"
          icon={AlertTriangle}
        />
        <KpiCard
          title="Movimientos registrados"
          value={movementsCount.toString()}
          description="Entradas y salidas acumuladas."
          tone="success"
          icon={ArrowLeftRight}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {modules.map((module, i) => (
          <ModuleAccessCard
            key={module.href}
            index={i + 1}
            tone={module.tone}
            icon={module.icon}
            title={module.title}
            description={module.description}
            href={module.href}
          />
        ))}
      </section>
    </main>
  );
}
