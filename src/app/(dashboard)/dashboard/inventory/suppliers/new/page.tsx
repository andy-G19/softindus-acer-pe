import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
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
      <section>
        <p className="text-sm font-medium text-slate-500">
          Inventario · Proveedores
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo proveedor</h1>
        <p className="text-slate-600">
          Registra los datos comerciales del proveedor para usarlo luego en
          compras y abastecimiento.
        </p>
      </section>

      <SupplierForm
        action={createSupplierAction}
        supplierTypes={supplierTypes}
        submitLabel="Guardar proveedor"
      />
    </main>
  );
}
