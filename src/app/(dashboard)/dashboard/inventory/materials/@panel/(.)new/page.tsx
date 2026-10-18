import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { createMaterialAction } from "@/modules/inventory/materials/actions";
import { MaterialForm } from "@/modules/inventory/materials/material-form";
import { getActiveMaterialCategoryOptions } from "@/modules/inventory/materials/queries";
import { inventoryNotifications } from "@/modules/inventory/notifications";

type NewMaterialPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de material en panel lateral (entrega 10.3), interceptada desde el
// listado. Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewMaterialPanel({ searchParams }: NewMaterialPanelProps) {
  await requireRole(["ADMIN"]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.materials);
  const categories = await getActiveMaterialCategoryOptions();

  return (
    <RouteSheet
      title="Nuevo material"
      description="Registra materia prima, consumibles, repuestos, herramientas u otros insumos del taller."
      discardTitle="¿Descartar el material nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <MaterialForm
        action={createMaterialAction}
        categories={categories}
        submitLabel="Guardar material"
        mode="create"
        successNotification={inventoryNotifications["material-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
