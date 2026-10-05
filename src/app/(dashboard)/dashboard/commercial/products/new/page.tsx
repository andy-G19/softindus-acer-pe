
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createProductAction } from "@/modules/commercial/products/actions";
import { ProductForm } from "@/modules/commercial/products/product-form";
import { getActiveProductCategoryOptions } from "@/modules/commercial/products/queries";

export default async function NewProductPage() {
  await requireRole(["ADMIN"]);

  const categories = await getActiveProductCategoryOptions();

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nuevo producto"
        description="Registra productos fabricados por el taller usando categorías dinámicas."
        backHref={navigationHrefs.products}
        backLabel="Volver a productos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Productos", href: navigationHrefs.products },
          { label: "Nuevo producto" },
        ])}
      />

      <ProductForm
        action={createProductAction}
        categories={categories}
        submitLabel="Guardar producto"
      />
    </main>
  );
}
