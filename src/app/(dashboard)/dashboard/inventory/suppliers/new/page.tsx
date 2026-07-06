import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createSupplierAction } from "@/modules/inventory/suppliers/actions";
import { SupplierForm } from "@/modules/inventory/suppliers/supplier-form";

export default async function NewSupplierPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const supplierTypes = await prisma.tipo_proveedor_catalogo.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      nombre: "asc",
    },
    select: {
      nombre: true,
      slug: true,
    },
  });

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
