import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { createSupplierAction } from "@/modules/inventory/suppliers/actions";
import { SupplierForm } from "@/modules/inventory/suppliers/supplier-form";
import { getActiveSupplierTypeOptions } from "@/modules/inventory/suppliers/queries";

type NewSupplierPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de proveedor en panel lateral (entrega 10.3b), interceptada desde el
// listado. Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewSupplierPanel({ searchParams }: NewSupplierPanelProps) {
  await requireRole(["ADMIN"]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.suppliers);
  const supplierTypes = await getActiveSupplierTypeOptions();

  return (
    <RouteSheet
      title="Nuevo proveedor"
      description="Registra los datos comerciales del proveedor para usarlo luego en compras y abastecimiento."
      discardTitle="¿Descartar el proveedor nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <SupplierForm
        action={createSupplierAction}
        supplierTypes={supplierTypes}
        submitLabel="Guardar proveedor"
        successNotification={inventoryNotifications["supplier-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
