import { notFound } from "next/navigation";

import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { updateSupplierAction } from "@/modules/inventory/suppliers/actions";
import { getSupplierEditValues } from "@/modules/inventory/suppliers/supplier-edit-values";
import { SupplierForm } from "@/modules/inventory/suppliers/supplier-form";
import { getSupplierEditData } from "@/modules/inventory/suppliers/queries";

type EditSupplierPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditSupplierPage({
  params,
  searchParams,
}: EditSupplierPageProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  await requireRole(["ADMIN"]);

  const supplierEditData = await getSupplierEditData(id);

  if (!supplierEditData) {
    notFound();
  }

  const { supplier, supplierTypes } = supplierEditData;
  const backHref = getSafeReturnTo(
    queryParams.returnTo,
    navigationHrefs.suppliers,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar proveedor"
        description="Actualiza los datos comerciales del proveedor."
        backHref={backHref}
        backLabel="Volver a proveedores"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Proveedores", href: backHref },
          { label: "Editar proveedor" },
        ])}
      />

      <SupplierForm
        action={updateSupplierAction}
        supplierTypes={supplierTypes}
        submitLabel="Guardar cambios"
        successNotification={inventoryNotifications["supplier-updated"]}
        returnTo={backHref}
        defaultValues={getSupplierEditValues(supplier)}
      />
    </div>
  );
}
