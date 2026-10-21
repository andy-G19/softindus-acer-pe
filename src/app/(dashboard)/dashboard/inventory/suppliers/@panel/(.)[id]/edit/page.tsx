import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { updateSupplierAction } from "@/modules/inventory/suppliers/actions";
import { getSupplierEditValues } from "@/modules/inventory/suppliers/supplier-edit-values";
import { SupplierForm } from "@/modules/inventory/suppliers/supplier-form";
import { getSupplierEditData } from "@/modules/inventory/suppliers/queries";

type EditSupplierPanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de proveedor en panel lateral (entrega 10.3b), interceptada desde el
// listado. Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditSupplierPanel({ params, searchParams }: EditSupplierPanelProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  await requireRole(["ADMIN"]);

  const supplierEditData = await getSupplierEditData(id);

  if (!supplierEditData) {
    notFound();
  }

  const { supplier, supplierTypes } = supplierEditData;
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.suppliers);

  return (
    <RouteSheet
      title="Editar proveedor"
      description={`${supplier.razon_social} · ${supplier.id_proveedor}`}
      discardTitle="¿Descartar los cambios del proveedor?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <SupplierForm
        action={updateSupplierAction}
        supplierTypes={supplierTypes}
        submitLabel="Guardar cambios"
        successNotification={inventoryNotifications["supplier-updated"]}
        returnTo={returnTo}
        defaultValues={getSupplierEditValues(supplier)}
      />
    </RouteSheet>
  );
}
