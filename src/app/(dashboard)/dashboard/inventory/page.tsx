import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Link2,
  Package,
  ShoppingCart,
  Truck,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/navigation/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleAccessCard } from "@/components/ui/module-access-card";
import { requireRole } from "@/lib/authz";
import { getInventoryOverviewData } from "@/modules/inventory/overview/queries";
import { dashboardBreadcrumbs } from "@/lib/navigation";
import { APP_ROLES, type AppRole } from "@/lib/permissions";

const ADMIN_ONLY: AppRole[] = [APP_ROLES.ADMIN];
const ADMIN_AND_WORKSHOP: AppRole[] = [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER];

export default async function InventoryPage() {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { materialsCount, suppliersCount, activeAlertsCount, movementsCount } =
    await getInventoryOverviewData();

  // Cada tarjeta lleva los roles que admite su pantalla (los de su
  // requireRole) y solo se muestra a ellos (entrega 10.3c): el maestro de
  // taller veia tarjetas que lo llevaban a «acceso denegado».
  // inventory-links.test.ts abre cada enlace con cada rol. El orden sigue el
  // flujo: primero el stock y despues la cadena de compra.
  const modules = [
    {
      title: "Materiales e insumos",
      href: "/dashboard/inventory/materials",
      description:
        "Registra materia prima, consumibles, repuestos, herramientas y stock mínimo.",
      icon: Package,
      tone: "chart-1" as const,
      roles: ADMIN_AND_WORKSHOP,
    },
    {
      title: "Entradas",
      href: "/dashboard/inventory/entries",
      description:
        "Consulta las entradas de stock que generan las compras y otros registros.",
      icon: ArrowDownToLine,
      tone: "chart-4" as const,
      roles: ADMIN_AND_WORKSHOP,
    },
    {
      title: "Salidas",
      href: "/dashboard/inventory/outputs",
      description:
        "Registra y consulta las salidas de stock a producción u otros motivos.",
      icon: ArrowUpFromLine,
      tone: "chart-3" as const,
      roles: ADMIN_AND_WORKSHOP,
    },
    {
      title: "Alertas y stock crítico",
      href: "/dashboard/inventory/alerts",
      description: "Consulta materiales críticos y alertas activas de inventario.",
      icon: AlertTriangle,
      tone: "chart-5" as const,
      roles: ADMIN_AND_WORKSHOP,
    },
    {
      title: "Proveedores",
      href: "/dashboard/inventory/suppliers",
      description:
        "Registra proveedores y prepara la asociación con materiales y compras.",
      icon: Truck,
      tone: "chart-2" as const,
      roles: ADMIN_ONLY,
    },
    {
      title: "Proveedor-material",
      href: "/dashboard/inventory/supplier-materials",
      description: "Asocia proveedores con los materiales que pueden abastecer.",
      icon: Link2,
      tone: "chart-3" as const,
      roles: ADMIN_ONLY,
    },
    {
      title: "Compras",
      href: "/dashboard/inventory/purchases",
      description: "Registra compras y genera entradas automáticas de inventario.",
      icon: ShoppingCart,
      tone: "chart-4" as const,
      roles: ADMIN_ONLY,
    },
    {
      title: "Pagos a proveedores",
      href: "/dashboard/inventory/supplier-payments",
      description:
        "Consulta los pagos registrados desde las compras y su saldo pendiente.",
      icon: Wallet,
      tone: "chart-2" as const,
      roles: ADMIN_ONLY,
    },
  ].filter((module) => module.roles.some((role) => role === session.user.role));

  return (
    <div className="space-y-8">
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
    </div>
  );
}
