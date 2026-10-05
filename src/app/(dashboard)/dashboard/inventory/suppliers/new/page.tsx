
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createSupplierAction } from "@/modules/inventory/suppliers/actions";
import { SupplierForm } from "@/modules/inventory/suppliers/supplier-form";
import { getActiveSupplierTypeOptions } from "@/modules/inventory/suppliers/queries";

export default async function NewSupplierPage() {
  await requireRole(["ADMIN"]);

  const supplierTypes = await getActiveSupplierTypeOptions();

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nuevo proveedor"
        description="Registra los datos comerciales del proveedor para usarlo luego en compras y abastecimiento."
        backHref={navigationHrefs.suppliers}
        backLabel="Volver a proveedores"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Proveedores", href: navigationHrefs.suppliers },
          { label: "Nuevo proveedor" },
        ])}
      />

      <SupplierForm
        action={createSupplierAction}
        supplierTypes={supplierTypes}
        submitLabel="Guardar proveedor"
      />
    </main>
  );
}
