
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import {
  createMaterialCategoryAction,
  toggleMaterialCategoryStatusAction,
  updateMaterialCategoryAction,
} from "@/modules/inventory/material-categories/actions";
import { InventoryCatalogManager } from "@/modules/inventory/components/inventory-catalog-manager";

export default async function MaterialCategoriesPage() {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
