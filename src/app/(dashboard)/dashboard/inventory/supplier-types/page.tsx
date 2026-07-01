import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { InventoryCatalogManager } from "@/modules/inventory/components/inventory-catalog-manager";
import {
  createSupplierTypeAction,
  toggleSupplierTypeStatusAction,
  updateSupplierTypeAction,
} from "@/modules/inventory/supplier-types/actions";

export default async function SupplierTypesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const supplierTypes = await prisma.tipo_proveedor_catalogo.findMany({
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre: "asc",
      },
    ],
  });

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Proveedores
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Tipos de proveedor
          </h1>
          <p className="text-slate-600">
            Administra los tipos dinámicos usados para clasificar proveedores.
          </p>
        </div>

        <Link
          href="/dashboard/inventory/suppliers"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Volver a proveedores
        </Link>
      </section>

      <InventoryCatalogManager
        idFieldName="id_tipo_proveedor"
        items={supplierTypes.map((supplierType) => ({
          id: supplierType.id_tipo_proveedor,
          nombre: supplierType.nombre,
          slug: supplierType.slug,
          descripcion: supplierType.descripcion,
          estado: supplierType.estado,
        }))}
        createAction={createSupplierTypeAction}
        updateAction={updateSupplierTypeAction}
        toggleAction={toggleSupplierTypeStatusAction}
        canManage
        createTitle="Nuevo tipo de proveedor"
        emptyMessage="Todavía no hay tipos de proveedor registrados."
      />
    </main>
  );
}
