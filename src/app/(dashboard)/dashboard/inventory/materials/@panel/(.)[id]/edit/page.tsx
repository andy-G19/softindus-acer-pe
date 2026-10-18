import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { updateMaterialAction } from "@/modules/inventory/materials/actions";
import { getMaterialEditValues } from "@/modules/inventory/materials/material-edit-values";
import { MaterialForm } from "@/modules/inventory/materials/material-form";
import { getMaterialEditData } from "@/modules/inventory/materials/queries";
import { inventoryNotifications } from "@/modules/inventory/notifications";

type EditMaterialPanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de material en panel lateral (entrega 10.3), interceptada desde el
// listado. Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditMaterialPanel({ params, searchParams }: EditMaterialPanelProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  await requireRole(["ADMIN"]);

  const materialEditData = await getMaterialEditData(id);

  if (!materialEditData) {
    notFound();
  }

  const { material, categories } = materialEditData;
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.materials);

  return (
    <RouteSheet
      title="Editar material"
      description={`${material.nombre_material} · ${material.id_material}`}
      discardTitle="¿Descartar los cambios del material?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <MaterialForm
        action={updateMaterialAction}
        categories={categories}
        submitLabel="Guardar cambios"
        mode="edit"
        successNotification={inventoryNotifications["material-updated"]}
        returnTo={returnTo}
        defaultValues={getMaterialEditValues(material)}
      />
    </RouteSheet>
  );
}
