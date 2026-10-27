import { notFound } from "next/navigation";

import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { updateProductAction } from "@/modules/commercial/products/actions";
import { getProductEditValues } from "@/modules/commercial/products/product-edit-values";
import { ProductForm } from "@/modules/commercial/products/product-form";
import { getProductEditData } from "@/modules/commercial/products/queries";

type EditProductPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  await requireRole(["ADMIN"]);

  const productEditData = await getProductEditData(id);

  if (!productEditData) {
    notFound();
  }

  const { product, categories } = productEditData;
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.products);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Editar producto"
        description="Actualiza los datos comerciales del producto."
        backHref={backHref}
        backLabel="Volver a productos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Productos", href: backHref },
          { label: "Editar producto" },
        ])}
      />

      <ProductForm
        action={updateProductAction}
        categories={categories}
        submitLabel="Guardar cambios"
        successNotification={commercialNotifications["product-updated"]}
        returnTo={backHref}
        defaultValues={getProductEditValues(product)}
      />
    </div>
  );
}
