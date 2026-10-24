import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { createProductAction } from "@/modules/commercial/products/actions";
import { ProductForm } from "@/modules/commercial/products/product-form";
import { getActiveProductCategoryOptions } from "@/modules/commercial/products/queries";

type NewProductPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  await requireRole(["ADMIN"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.products);
  const categories = await getActiveProductCategoryOptions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nuevo producto"
        description="Registra productos fabricados por el taller usando categorías dinámicas."
        backHref={backHref}
        backLabel="Volver a productos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Productos", href: backHref },
          { label: "Nuevo producto" },
        ])}
      />

      <ProductForm
        action={createProductAction}
        categories={categories}
        submitLabel="Guardar producto"
        successNotification={commercialNotifications["product-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
