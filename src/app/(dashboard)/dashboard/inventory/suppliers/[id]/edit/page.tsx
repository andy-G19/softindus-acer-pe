import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
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
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

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
      <section>
        <p className="text-sm font-medium text-slate-500">
          Inventario · Proveedores
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Editar proveedor</h1>
        <p className="text-slate-600">
          Actualiza los datos comerciales del proveedor.
        </p>
      </section>

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
