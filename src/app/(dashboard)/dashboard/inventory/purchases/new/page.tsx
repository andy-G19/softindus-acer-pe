import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { getNewPurchaseFormOptions } from "@/modules/inventory/purchases/queries";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { createPurchaseAction } from "@/modules/inventory/purchases/actions";
import { PurchaseForm } from "@/modules/inventory/purchases/purchase-form";

type NewPurchasePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewPurchasePage({ searchParams }: NewPurchasePageProps) {
  await requireRole(["ADMIN"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.purchases);
  const { suppliers, materials } = await getNewPurchaseFormOptions();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Nueva compra"
        description="Registra una compra de materiales y genera automáticamente la entrada de inventario."
        backHref={backHref}
        backLabel="Volver a compras"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Compras", href: backHref },
          { label: "Nueva compra" },
        ])}
      />

      <PurchaseForm
        action={createPurchaseAction}
        suppliers={suppliers}
        materials={materials.map((material) => ({
          id_material: material.id_material,
          nombre_material: material.nombre_material,
          unidad_medida: material.unidad_medida,
          costo_unitario_actual: material.costo_unitario_actual.toString(),
        }))}
        successNotification={inventoryNotifications["purchase-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
