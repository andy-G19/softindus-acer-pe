import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { toggleProductCategoryStatusAction } from "@/modules/commercial/products/actions";
import { ProductCategoryManager } from "@/modules/commercial/products/product-category-manager";

export default async function ProductCategoriesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const categories = await prisma.categoria_producto.findMany({
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Categorías de productos</h1>
          <p className="text-sm text-muted-foreground">
            Administra las categorías usadas en productos comerciales.
          </p>
        </div>

        <Link
          href="/dashboard/commercial/products"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Volver a productos
        </Link>
      </div>

      {!canManage ? (
        <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
          Tu usuario puede consultar categorías, pero solo ADMIN puede crearlas
          o modificarlas.
        </div>
      ) : null}

      <ProductCategoryManager
        categories={categories}
        canManage={canManage}
        toggleAction={toggleProductCategoryStatusAction}
      />
    </main>
  );
}
