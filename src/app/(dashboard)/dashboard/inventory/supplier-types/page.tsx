
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Button } from "@/components/ui/button";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { InventoryCatalogDialog } from "@/modules/inventory/components/inventory-catalog-dialog";
import { InventoryCatalogManager } from "@/modules/inventory/components/inventory-catalog-manager";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import {
  createSupplierTypeAction,
  toggleSupplierTypeStatusAction,
  updateSupplierTypeAction,
} from "@/modules/inventory/supplier-types/actions";
import { getSupplierTypeList } from "@/modules/inventory/supplier-types/queries";

export default async function SupplierTypesPage() {
  await requireRole(["ADMIN"]);

  const supplierTypes = await getSupplierTypeList();

  return (
    <div className="space-y-6">
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
        actions={
          <InventoryCatalogDialog
            action={createSupplierTypeAction}
            idFieldName="id_tipo_proveedor"
            title="Nuevo tipo de proveedor"
            submitLabel="Crear"
            successNotification={inventoryNotifications["supplier-type-created"]}
            discardTitle="¿Descartar el tipo de proveedor?"
            trigger={<Button type="button">Nuevo tipo de proveedor</Button>}
          />
        }
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
        updateAction={updateSupplierTypeAction}
        updateNotification={inventoryNotifications["supplier-type-updated"]}
        toggleAction={toggleSupplierTypeStatusAction}
        activatedNotification={inventoryNotifications["supplier-type-activated"]}
        deactivatedNotification={inventoryNotifications["supplier-type-deactivated"]}
        entityLabel="el tipo de proveedor"
        inactivateConsequence="Dejará de ofrecerse al registrar proveedores; los que ya lo usan lo conservan. Puedes volver a activarlo."
        canManage
        editTitle="Editar tipo de proveedor"
        discardTitle="¿Descartar el tipo de proveedor?"
        emptyMessage="Todavía no hay tipos de proveedor registrados."
      />
    </div>
  );
}
