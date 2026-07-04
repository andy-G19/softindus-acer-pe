import { ModuleAccessCard } from "./module-access-card";

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
          title="Módulo comercial"
          description="Clientes, productos, pedidos, proformas, pagos y comprobantes."
          href="/dashboard/commercial"
        />
      ) : null}

      {canAccessInventory ? (
        <ModuleAccessCard
          title="Inventario y proveedores"
          description="Control de materiales, stock, proveedores, compras y abastecimiento."
          href="/dashboard/inventory"
        />
      ) : null}

      {canAccessProduction ? (
        <ModuleAccessCard
          title="Producción y recetas técnicas"
          description="Órdenes de trabajo, rutas de fabricación, etapas, avances y recetas técnicas."
          href="/dashboard/production"
        />
      ) : null}

      {canAccessWasteScrap ? (
        <ModuleAccessCard
          title="Mermas y chatarra"
          description="Registro de retazos reutilizables, chatarra generada, ventas de chatarra y destino del dinero."
          href="/dashboard/waste-scrap"
        />
      ) : null}

      {canAccessCosts ? (
        <ModuleAccessCard
          title="Costos y rentabilidad"
          description="Costeo de producción, costos indirectos, márgenes, precios sugeridos y utilidad estimada."
          href="/dashboard/costs"
        />
      ) : null}

      {canAccessPettyCash ? (
        <ModuleAccessCard
          title="Caja chica y finanzas"
          description="Control de caja chica, ingresos menores, egresos, categorías de gasto y resumen financiero mensual."
          href="/dashboard/petty-cash"
        />
      ) : null}

      {canAccessStaff ? (
        <ModuleAccessCard
          title="Personal, asistencia y pagos"
          description="Operarios, asistencia diaria, tareas, planillas e historial de pagos."
          href="/dashboard/staff"
        />
      ) : null}

      {canAccessMaintenance ? (
        <ModuleAccessCard
          title="Mantenimiento de maquinaria"
          description="Máquinas, fallas, repuestos, reparaciones, preventivos y reincidencias."
          href="/dashboard/maintenance"
        />
      ) : null}

      {canAccessReports ? (
        <ModuleAccessCard
          title={reportsTitle}
          description={reportsDescription}
          href={reportsHref}
        />
      ) : null}
    </div>
  );
}
