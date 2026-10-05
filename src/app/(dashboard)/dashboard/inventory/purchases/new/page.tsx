import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { getNewPurchaseFormOptions } from "@/modules/inventory/purchases/queries";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { PurchaseForm } from "@/components/inventory/purchase-form";

export default async function NewPurchasePage() {
  await requireRole(["ADMIN"]);

  const { suppliers, materials } = await getNewPurchaseFormOptions();

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Nueva compra"
        description="Registra una compra de materiales y genera automáticamente la entrada de inventario."
        backHref={navigationHrefs.purchases}
        backLabel="Volver a compras"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Compras", href: navigationHrefs.purchases },
          { label: "Nueva compra" },
        ])}
      />

      <PurchaseForm
        suppliers={suppliers}
        materials={materials.map((material) => ({
          id_material: material.id_material,
          nombre_material: material.nombre_material,
          unidad_medida: material.unidad_medida,
          costo_unitario_actual: material.costo_unitario_actual.toString(),
        }))}
      />
    </main>
  );
}
