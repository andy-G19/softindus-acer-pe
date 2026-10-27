import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { updateProductAction } from "@/modules/commercial/products/actions";
import { getProductEditValues } from "@/modules/commercial/products/product-edit-values";
import { ProductForm } from "@/modules/commercial/products/product-form";
import { getProductEditData } from "@/modules/commercial/products/queries";

type EditProductPanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de producto en panel lateral (entrega 10.4a), interceptada desde el
// listado. Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditProductPanel({ params, searchParams }: EditProductPanelProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  await requireRole(["ADMIN"]);

  const productEditData = await getProductEditData(id);

  if (!productEditData) {
    notFound();
  }

  const { product, categories } = productEditData;
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.products);

  return (
    <RouteSheet
      title="Editar producto"
      description={`${product.nombre_producto} · ${product.id_producto}`}
      discardTitle="¿Descartar los cambios del producto?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <ProductForm
        action={updateProductAction}
        categories={categories}
        submitLabel="Guardar cambios"
        successNotification={commercialNotifications["product-updated"]}
        returnTo={returnTo}
        defaultValues={getProductEditValues(product)}
      />
    </RouteSheet>
  );
}
