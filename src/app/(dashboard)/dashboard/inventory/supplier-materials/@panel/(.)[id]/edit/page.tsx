import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { updateSupplierMaterialAction } from "@/modules/inventory/supplier-materials/actions";
import { SupplierMaterialForm } from "@/modules/inventory/supplier-materials/supplier-material-form";
import {
  getSupplierMaterialEditValues,
  getSupplierMaterialOptions,
} from "@/modules/inventory/supplier-materials/supplier-material-form-data";
import { getSupplierMaterialEditData } from "@/modules/inventory/supplier-materials/queries";

type EditSupplierMaterialPanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de asociacion en panel lateral (entrega 10.3b), interceptada desde
// el listado. Misma consulta, formulario, accion y permisos que
// [id]/edit/page.tsx.
export default async function EditSupplierMaterialPanel({ params, searchParams }: EditSupplierMaterialPanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const supplierMaterialEditData = await getSupplierMaterialEditData(id);

  if (!supplierMaterialEditData) {
    notFound();
  }

  const { relation, suppliers, materials } = supplierMaterialEditData;
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.supplierMaterials);

  return (
    <RouteSheet
      title="Editar asociación proveedor-material"
      description={`${relation.proveedor.razon_social} · ${relation.material.nombre_material}`}
      discardTitle="¿Descartar los cambios de la asociación?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <SupplierMaterialForm
        action={updateSupplierMaterialAction}
        {...getSupplierMaterialOptions(suppliers, materials)}
        defaultValues={getSupplierMaterialEditValues(relation)}
        submitLabel="Guardar cambios"
        successNotification={inventoryNotifications["supplier-material-updated"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
