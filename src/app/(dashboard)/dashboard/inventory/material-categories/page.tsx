import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import {
  createMaterialCategoryAction,
  toggleMaterialCategoryStatusAction,
  updateMaterialCategoryAction,
} from "@/modules/inventory/material-categories/actions";
import { InventoryCatalogDialog } from "@/modules/inventory/components/inventory-catalog-dialog";
import { InventoryCatalogManager } from "@/modules/inventory/components/inventory-catalog-manager";
import { getMaterialCategoryList } from "@/modules/inventory/material-categories/queries";
import { inventoryNotifications } from "@/modules/inventory/notifications";

export default async function MaterialCategoriesPage() {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const categories = await getMaterialCategoryList();

  const canManage = session.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías de materiales"
        description="Administra las categorías dinámicas usadas por materiales e insumos."
        backHref={navigationHrefs.materials}
        backLabel="Volver a materiales"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Materiales", href: navigationHrefs.materials },
          { label: "Categorías" },
        ])}
        actions={
          canManage ? (
            <InventoryCatalogDialog
              action={createMaterialCategoryAction}
              idFieldName="id_categoria_material"
              title="Nueva categoría"
              submitLabel="Crear"
              successNotification={inventoryNotifications["material-category-created"]}
              discardTitle="¿Descartar la categoría de material?"
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

      <InventoryCatalogManager
        idFieldName="id_categoria_material"
        items={categories.map((category) => ({
          id: category.id_categoria_material,
          nombre: category.nombre,
          slug: category.slug,
          descripcion: category.descripcion,
          estado: category.estado,
        }))}
        updateAction={updateMaterialCategoryAction}
        updateNotification={inventoryNotifications["material-category-updated"]}
        toggleAction={toggleMaterialCategoryStatusAction}
        activatedNotification={inventoryNotifications["material-category-activated"]}
        deactivatedNotification={inventoryNotifications["material-category-deactivated"]}
        entityLabel="la categoría de material"
        inactivateConsequence="Dejará de ofrecerse al registrar materiales; los que ya la usan la conservan. Puedes volver a activarla."
        canManage={canManage}
        editTitle="Editar categoría"
        discardTitle="¿Descartar la categoría de material?"
        emptyMessage="Todavía no hay categorías de materiales registradas."
      />
    </div>
  );
}
