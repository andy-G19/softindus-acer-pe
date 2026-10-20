import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { createSupplierMaterialAction } from "@/modules/inventory/supplier-materials/actions";
import { SupplierMaterialForm } from "@/modules/inventory/supplier-materials/supplier-material-form";
import { getSupplierMaterialOptions } from "@/modules/inventory/supplier-materials/supplier-material-form-data";
import { getNewSupplierMaterialFormOptions } from "@/modules/inventory/supplier-materials/queries";

type NewSupplierMaterialPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de asociacion en panel lateral (entrega 10.3b), interceptada desde el
// listado. Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewSupplierMaterialPanel({ searchParams }: NewSupplierMaterialPanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.supplierMaterials);
  const { suppliers, materials } = await getNewSupplierMaterialFormOptions();

  return (
    <RouteSheet
      title="Nueva asociación proveedor-material"
      description="Relaciona proveedores activos con materiales activos para mantener precios referenciales, disponibilidad y tiempos de entrega."
      discardTitle="¿Descartar la asociación nueva?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <SupplierMaterialForm
        action={createSupplierMaterialAction}
        {...getSupplierMaterialOptions(suppliers, materials)}
        submitLabel="Guardar asociación"
        successNotification={inventoryNotifications["supplier-material-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
