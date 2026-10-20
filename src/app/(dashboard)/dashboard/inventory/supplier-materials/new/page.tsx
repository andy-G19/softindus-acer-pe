import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { createSupplierMaterialAction } from "@/modules/inventory/supplier-materials/actions";
import { SupplierMaterialForm } from "@/modules/inventory/supplier-materials/supplier-material-form";
import { getSupplierMaterialOptions } from "@/modules/inventory/supplier-materials/supplier-material-form-data";
import { getNewSupplierMaterialFormOptions } from "@/modules/inventory/supplier-materials/queries";

type NewSupplierMaterialPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewSupplierMaterialPage({ searchParams }: NewSupplierMaterialPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.supplierMaterials);
  const { suppliers, materials } = await getNewSupplierMaterialFormOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva asociación proveedor-material"
        description="Relaciona proveedores activos con materiales activos para mantener precios referenciales, disponibilidad y tiempos de entrega."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          {
            label: "Proveedor-material",
            href: backHref,
          },
          { label: "Nueva asociación" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la asociación</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierMaterialForm
            action={createSupplierMaterialAction}
            {...getSupplierMaterialOptions(suppliers, materials)}
            submitLabel="Guardar asociación"
            successNotification={inventoryNotifications["supplier-material-created"]}
            returnTo={backHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
