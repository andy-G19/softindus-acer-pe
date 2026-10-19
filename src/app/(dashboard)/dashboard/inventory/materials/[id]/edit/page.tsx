import { notFound } from "next/navigation";

import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { updateMaterialAction } from "@/modules/inventory/materials/actions";
import { getMaterialEditValues } from "@/modules/inventory/materials/material-edit-values";
import { MaterialForm } from "@/modules/inventory/materials/material-form";
import { getMaterialEditData } from "@/modules/inventory/materials/queries";
import { inventoryNotifications } from "@/modules/inventory/notifications";

type EditMaterialPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditMaterialPage({
  params,
  searchParams,
}: EditMaterialPageProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  await requireRole(["ADMIN"]);

  const materialEditData = await getMaterialEditData(id);

  if (!materialEditData) {
    notFound();
  }

  const { material, categories } = materialEditData;
  const backHref = getSafeReturnTo(
    queryParams.returnTo,
    navigationHrefs.materials,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar material"
        description="Actualiza los datos maestros del material. El stock se mantiene por movimientos de inventario."
        backHref={backHref}
        backLabel="Volver a materiales"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Materiales", href: backHref },
          { label: "Editar material" },
        ])}
      />

      <MaterialForm
        action={updateMaterialAction}
        categories={categories}
        submitLabel="Guardar cambios"
        mode="edit"
        successNotification={inventoryNotifications["material-updated"]}
        returnTo={backHref}
        defaultValues={getMaterialEditValues(material)}
      />
    </div>
  );
}
