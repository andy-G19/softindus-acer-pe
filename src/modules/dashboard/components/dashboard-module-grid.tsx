/**
 * Ubicación destino: src/modules/dashboard/components/dashboard-module-grid.tsx
 * (reemplaza el archivo actual)
 *
 * Íconos reutilizados 1:1 de src/components/layout/dashboard-nav.tsx (navIconsByHref)
 * para que el sidebar y estas tarjetas usen exactamente el mismo ícono por módulo.
 * Tonos: se ciclan chart-1..chart-5 (ya definidos en globals.css), no colores nuevos.
 */
import {
  BarChart3,
  Calculator,
  Factory,
  Package,
  Recycle,
  ShoppingCart,
  UserRoundCheck,
  WalletCards,
  Wrench,
} from "lucide-react";

import { ModuleAccessCard } from "@/components/ui/module-access-card";

type DashboardModuleGridProps = {
  role: string;
};

export function DashboardModuleGrid({ role }: DashboardModuleGridProps) {
  const canAccessCommercial = ["ADMIN", "SELLER"].includes(role);
  const canAccessInventory = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessProduction = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessWasteScrap = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessCosts = role === "ADMIN";
  const canAccessPettyCash = role === "ADMIN";
  const canAccessStaff = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessMaintenance = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessReports = ["ADMIN", "SELLER", "WORKSHOP_MASTER"].includes(role);
  const reportsHref =
    role === "SELLER"
      ? "/dashboard/reports/sales-collections"
      : role === "WORKSHOP_MASTER"
        ? "/dashboard/reports/production"
        : "/dashboard/reports";
  const reportsTitle =
    role === "SELLER"
      ? "Reportes comerciales"
      : role === "WORKSHOP_MASTER"
        ? "Reportes operativos"
        : "Reportes, exportaciones y auditoría";
  const reportsDescription =
    role === "SELLER"
      ? "Ventas, cobranzas, pedidos y saldos pendientes."
      : role === "WORKSHOP_MASTER"
        ? "Producción, inventario operativo y mantenimiento."
        : "Indicadores generales, exportaciones, historial y bitácora.";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {canAccessCommercial ? (
        <ModuleAccessCard
          index={1}
          tone="chart-1"
          icon={ShoppingCart}
          title="Módulo comercial"
          description="Clientes, productos, pedidos, proformas, pagos y comprobantes."
          href="/dashboard/commercial"
        />
      ) : null}

      {canAccessInventory ? (
        <ModuleAccessCard
          index={2}
          tone="chart-2"
          icon={Package}
          title="Inventario y proveedores"
          description="Control de materiales, stock, proveedores, compras y abastecimiento."
          href="/dashboard/inventory"
        />
      ) : null}

      {canAccessProduction ? (
        <ModuleAccessCard
          index={3}
          tone="chart-3"
          icon={Factory}
          title="Producción y recetas técnicas"
          description="Órdenes de trabajo, rutas de fabricación, etapas, avances y recetas técnicas."
          href="/dashboard/production"
        />
      ) : null}

      {canAccessWasteScrap ? (
        <ModuleAccessCard
          index={4}
          tone="chart-4"
          icon={Recycle}
          title="Mermas y chatarra"
          description="Registro de retazos reutilizables, chatarra generada, ventas de chatarra y destino del dinero."
          href="/dashboard/waste-scrap"
        />
      ) : null}

      {canAccessCosts ? (
        <ModuleAccessCard
          index={5}
          tone="chart-5"
          icon={Calculator}
          title="Costos y rentabilidad"
          description="Costeo de producción, costos indirectos, márgenes, precios sugeridos y utilidad estimada."
          href="/dashboard/costs"
        />
      ) : null}

      {canAccessPettyCash ? (
        <ModuleAccessCard
          index={6}
          tone="chart-1"
          icon={WalletCards}
          title="Caja chica y finanzas"
          description="Control de caja chica, ingresos menores, egresos, categorías de gasto y resumen financiero mensual."
          href="/dashboard/petty-cash"
        />
      ) : null}

      {canAccessStaff ? (
        <ModuleAccessCard
          index={7}
          tone="chart-2"
          icon={UserRoundCheck}
          title="Personal, asistencia y pagos"
          description="Operarios, asistencia diaria, tareas, planillas e historial de pagos."
          href="/dashboard/staff"
        />
      ) : null}

      {canAccessMaintenance ? (
        <ModuleAccessCard
          index={8}
          tone="chart-3"
          icon={Wrench}
          title="Mantenimiento de maquinaria"
          description="Máquinas, fallas, repuestos, reparaciones, preventivos y reincidencias."
          href="/dashboard/maintenance"
        />
      ) : null}

      {canAccessReports ? (
        <ModuleAccessCard
          index={9}
          tone="chart-4"
          icon={BarChart3}
          title={reportsTitle}
          description={reportsDescription}
          href={reportsHref}
        />
      ) : null}
    </div>
  );
}
