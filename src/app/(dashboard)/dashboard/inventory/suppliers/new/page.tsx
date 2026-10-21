import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { createSupplierAction } from "@/modules/inventory/suppliers/actions";
import { SupplierForm } from "@/modules/inventory/suppliers/supplier-form";
import { getActiveSupplierTypeOptions } from "@/modules/inventory/suppliers/queries";

type NewSupplierPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewSupplierPage({ searchParams }: NewSupplierPageProps) {
  await requireRole(["ADMIN"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.suppliers);
  const supplierTypes = await getActiveSupplierTypeOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nuevo proveedor"
        description="Registra los datos comerciales del proveedor para usarlo luego en compras y abastecimiento."
        backHref={backHref}
        backLabel="Volver a proveedores"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Proveedores", href: backHref },
          { label: "Nuevo proveedor" },
        ])}
      />

      <SupplierForm
        action={createSupplierAction}
        supplierTypes={supplierTypes}
        submitLabel="Guardar proveedor"
        successNotification={inventoryNotifications["supplier-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
