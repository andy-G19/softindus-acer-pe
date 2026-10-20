import { notFound } from "next/navigation";

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
import { updateSupplierMaterialAction } from "@/modules/inventory/supplier-materials/actions";
import { SupplierMaterialForm } from "@/modules/inventory/supplier-materials/supplier-material-form";
import {
  getSupplierMaterialEditValues,
  getSupplierMaterialOptions,
} from "@/modules/inventory/supplier-materials/supplier-material-form-data";
import { getSupplierMaterialEditData } from "@/modules/inventory/supplier-materials/queries";

type EditSupplierMaterialPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditSupplierMaterialPage({
  params,
  searchParams,
}: EditSupplierMaterialPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const supplierMaterialEditData = await getSupplierMaterialEditData(id);

  if (!supplierMaterialEditData) {
    notFound();
  }

  const { relation, suppliers, materials } = supplierMaterialEditData;
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.supplierMaterials);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar asociación proveedor-material"
        description="Actualiza el proveedor, material, precio referencial, disponibilidad y tiempo de entrega."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          {
            label: "Proveedor-material",
            href: backHref,
          },
          { label: "Editar asociación" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la asociación</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierMaterialForm
            action={updateSupplierMaterialAction}
            {...getSupplierMaterialOptions(suppliers, materials)}
            defaultValues={getSupplierMaterialEditValues(relation)}
            submitLabel="Guardar cambios"
            successNotification={inventoryNotifications["supplier-material-updated"]}
            returnTo={backHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
