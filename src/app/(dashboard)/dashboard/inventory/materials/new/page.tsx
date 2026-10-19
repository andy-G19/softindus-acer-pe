import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { createMaterialAction } from "@/modules/inventory/materials/actions";
import { MaterialForm } from "@/modules/inventory/materials/material-form";
import { getActiveMaterialCategoryOptions } from "@/modules/inventory/materials/queries";
import { inventoryNotifications } from "@/modules/inventory/notifications";

type NewMaterialPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewMaterialPage({ searchParams }: NewMaterialPageProps) {
  await requireRole(["ADMIN"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.materials);
  const categories = await getActiveMaterialCategoryOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nuevo material"
        description="Registra materia prima, consumibles, repuestos, herramientas u otros insumos del taller."
        backHref={backHref}
        backLabel="Volver a materiales"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Materiales", href: backHref },
          { label: "Nuevo material" },
        ])}
      />

      <MaterialForm
        action={createMaterialAction}
        categories={categories}
        submitLabel="Guardar material"
        mode="create"
        successNotification={inventoryNotifications["material-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
