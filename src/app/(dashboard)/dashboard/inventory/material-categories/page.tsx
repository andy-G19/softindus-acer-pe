import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  createMaterialCategoryAction,
  toggleMaterialCategoryStatusAction,
  updateMaterialCategoryAction,
} from "@/modules/inventory/material-categories/actions";
import { InventoryCatalogManager } from "@/modules/inventory/components/inventory-catalog-manager";

export default async function MaterialCategoriesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "WORKSHOP_MASTER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const categories = await prisma.categoria_material.findMany({
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre: "asc",
      },
    ],
  });

  const canManage = session.user.role === "ADMIN";

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Materiales
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Categorías de materiales
          </h1>
          <p className="text-slate-600">
            Administra las categorías dinámicas usadas por materiales e
            insumos.
          </p>
        </div>

        <Link
          href="/dashboard/inventory/materials"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Volver a materiales
        </Link>
      </section>

      {!canManage ? (
        <div className="rounded-md border px-4 py-3 text-sm text-slate-600">
          Tu usuario puede consultar categorías, pero solo ADMIN puede crearlas
          o modificarlas.
        </div>
      ) : null}

      <InventoryCatalogManager
        idFieldName="id_categoria_material"
        items={categories.map((category) => ({
          id: category.id_categoria_material,
          nombre: category.nombre,
          slug: category.slug,
          descripcion: category.descripcion,
          estado: category.estado,
        }))}
        createAction={createMaterialCategoryAction}
        updateAction={updateMaterialCategoryAction}
        toggleAction={toggleMaterialCategoryStatusAction}
        canManage={canManage}
        createTitle="Nueva categoría"
        emptyMessage="Todavía no hay categorías de materiales registradas."
      />
    </main>
  );
}
