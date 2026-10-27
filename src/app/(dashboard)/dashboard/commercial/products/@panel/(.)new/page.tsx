import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { createProductAction } from "@/modules/commercial/products/actions";
import { ProductForm } from "@/modules/commercial/products/product-form";
import { getActiveProductCategoryOptions } from "@/modules/commercial/products/queries";

type NewProductPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de producto en panel lateral (entrega 10.4a), interceptada desde el
// listado. Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewProductPanel({ searchParams }: NewProductPanelProps) {
  await requireRole(["ADMIN"]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.products);
  const categories = await getActiveProductCategoryOptions();

  return (
    <RouteSheet
      title="Nuevo producto"
      description="Registra productos fabricados por el taller usando categorías dinámicas."
      discardTitle="¿Descartar el producto nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <ProductForm
        action={createProductAction}
        categories={categories}
        submitLabel="Guardar producto"
        successNotification={commercialNotifications["product-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
