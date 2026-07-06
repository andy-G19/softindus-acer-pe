import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
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
      <PageHeader
        title="Categorías de productos"
        description="Administra las categorías usadas en productos comerciales."
        backHref={navigationHrefs.products}
        backLabel="Volver a productos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Productos", href: navigationHrefs.products },
          { label: "Categorías" },
        ])}
      />

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
