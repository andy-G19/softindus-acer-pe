
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { InventoryCatalogManager } from "@/modules/inventory/components/inventory-catalog-manager";
import {
  createSupplierTypeAction,
  toggleSupplierTypeStatusAction,
  updateSupplierTypeAction,
} from "@/modules/inventory/supplier-types/actions";

export default async function SupplierTypesPage() {
  await requireRole(["ADMIN"]);

  const supplierTypes = await prisma.tipo_proveedor_catalogo.findMany({
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre: "asc",
      },
    ],
  });

  return (
    <main className="space-y-6">
      <PageHeader
        title="Tipos de proveedor"
        description="Administra los tipos dinámicos usados para clasificar proveedores."
        backHref={navigationHrefs.suppliers}
        backLabel="Volver a proveedores"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Proveedores", href: navigationHrefs.suppliers },
          { label: "Tipos de proveedor" },
        ])}
      />

      <InventoryCatalogManager
        idFieldName="id_tipo_proveedor"
        items={supplierTypes.map((supplierType) => ({
          id: supplierType.id_tipo_proveedor,
          nombre: supplierType.nombre,
          slug: supplierType.slug,
          descripcion: supplierType.descripcion,
          estado: supplierType.estado,
        }))}
        createAction={createSupplierTypeAction}
        updateAction={updateSupplierTypeAction}
        toggleAction={toggleSupplierTypeStatusAction}
        canManage
        createTitle="Nuevo tipo de proveedor"
        emptyMessage="Todavía no hay tipos de proveedor registrados."
      />
    </main>
  );
}
