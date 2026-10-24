import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import {
  createProductCategoryAction,
  toggleProductCategoryStatusAction,
  updateProductCategoryAction,
} from "@/modules/commercial/products/actions";
import { ProductCategoryDialog } from "@/modules/commercial/products/product-category-dialog";
import { ProductCategoryManager } from "@/modules/commercial/products/product-category-manager";
import { getProductCategoryList } from "@/modules/commercial/products/queries";
import { commercialNotifications } from "@/modules/commercial/notifications";

export default async function ProductCategoriesPage() {
  const session = await requireRole(["ADMIN", "SELLER"]);

  const categories = await getProductCategoryList();

  const canManage = session.user.role === "ADMIN";

  return (
    <div className="space-y-6">
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
        actions={
          canManage ? (
            <ProductCategoryDialog
              action={createProductCategoryAction}
              title="Nueva categoría"
              submitLabel="Crear categoría"
              successNotification={commercialNotifications["product-category-created"]}
              trigger={<Button type="button">Nueva categoría</Button>}
            />
          ) : null
        }
      />

      {!canManage ? (
        <Alert variant="info">
          <AlertDescription>
            Tu usuario puede consultar categorías, pero solo ADMIN puede
            crearlas o modificarlas.
          </AlertDescription>
        </Alert>
      ) : null}

      <ProductCategoryManager
        categories={categories}
        canManage={canManage}
        updateAction={updateProductCategoryAction}
        updateNotification={commercialNotifications["product-category-updated"]}
        toggleAction={toggleProductCategoryStatusAction}
        activatedNotification={commercialNotifications["product-category-activated"]}
        deactivatedNotification={commercialNotifications["product-category-deactivated"]}
      />
    </div>
  );
}
