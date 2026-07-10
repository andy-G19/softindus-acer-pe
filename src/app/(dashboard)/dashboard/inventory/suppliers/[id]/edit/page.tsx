import { notFound } from "next/navigation";

import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { updateSupplierAction } from "@/modules/inventory/suppliers/actions";
import { SupplierForm } from "@/modules/inventory/suppliers/supplier-form";

type EditSupplierPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditSupplierPage({
  params,
}: EditSupplierPageProps) {
  const { id } = await params;
  await requireRole(["ADMIN"]);

  const supplier = await prisma.proveedor.findUnique({
    where: {
      id_proveedor: id,
    },
  });

  if (!supplier) {
    notFound();
  }

  const supplierTypes = await prisma.tipo_proveedor_catalogo.findMany({
    where: {
      OR: [
        {
          estado: true,
        },
        {
          slug: supplier.tipo_proveedor,
        },
      ],
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
        title="Editar proveedor"
        description="Actualiza los datos comerciales del proveedor."
        backHref={navigationHrefs.suppliers}
        backLabel="Volver a proveedores"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Proveedores", href: navigationHrefs.suppliers },
          { label: "Editar proveedor" },
        ])}
      />

      <SupplierForm
        action={updateSupplierAction}
        supplierTypes={supplierTypes}
        submitLabel="Guardar cambios"
        defaultValues={{
          id_proveedor: supplier.id_proveedor,
          razon_social: supplier.razon_social,
          tipo_documento: supplier.tipo_documento ?? "",
          numero_documento: supplier.numero_documento ?? "",
          telefono: supplier.telefono ?? "",
          correo: supplier.correo ?? "",
          direccion: supplier.direccion ?? "",
          contacto_principal: supplier.contacto_principal ?? "",
          tipo_proveedor: supplier.tipo_proveedor,
          condicion_pago: supplier.condicion_pago ?? "",
          observaciones: supplier.observaciones ?? "",
        }}
      />
    </main>
  );
}
