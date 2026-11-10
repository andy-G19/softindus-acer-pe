
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { createInventoryOutputAction } from "@/modules/inventory/movements/actions";
import { InventoryOutputForm } from "@/modules/inventory/movements/inventory-output-form";
import { getInventoryOutputFormOptions } from "@/modules/inventory/movements/queries";

type NewInventoryOutputPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewInventoryOutputPage({ searchParams }: NewInventoryOutputPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.inventoryOutputs);

  const { materials, workOrders } = await getInventoryOutputFormOptions();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Registrar salida de inventario"
        description="La salida descuenta stock actual y registra stock anterior/resultante."
        backHref={backHref}
        backLabel="Volver a salidas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Salidas", href: backHref },
          { label: "Registrar salida" },
        ])}
      />

      <InventoryOutputForm
        action={createInventoryOutputAction}
        materials={materials.map((material) => {
          const disponible =
            Number(material.stock_actual.toString()) -
            Number(material.stock_reservado.toString());

          return {
            id: material.id_material,
            label: `${material.nombre_material} (${disponible.toFixed(2)} ${material.unidad_medida} disponible)`,
          };
        })}
        workOrders={workOrders.map((order) => ({
          id: order.id_orden_trabajo,
          label: `${order.id_orden_trabajo} - ${order.estado}`,
        }))}
        successNotification={inventoryNotifications["inventory-movement-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
