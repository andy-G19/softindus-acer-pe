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
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateSparePartAction } from "@/modules/maintenance/spare-parts/actions";
import { SparePartForm } from "@/modules/maintenance/spare-parts/spare-part-form";
import { getSparePartEditData } from "@/modules/maintenance/spare-parts/queries";

type EditSparePartPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditSparePartPage({
  params,
}: EditSparePartPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const sparePartEditData = await getSparePartEditData(id);

  if (!sparePartEditData) {
    notFound();
  }

  const { sparePart, providers, supplierTypes } = sparePartEditData;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Editar repuesto"
        description="Actualiza datos maestros del repuesto sin tocar reparaciones."
        backHref={navigationHrefs.spareParts}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Repuestos", href: navigationHrefs.spareParts },
          { label: "Editar repuesto" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos principales</CardTitle>
        </CardHeader>
        <CardContent>
          <SparePartForm
            action={updateSparePartAction}
            providers={providers.map((provider) => ({
              id: provider.id_proveedor,
              label: provider.razon_social,
            }))}
            supplierTypes={supplierTypes}
            defaultValues={{
              id_repuesto: sparePart.id_repuesto,
              id_proveedor: sparePart.id_proveedor ?? "",
              nombre_repuesto: sparePart.nombre_repuesto,
              descripcion: sparePart.descripcion ?? "",
              costo_unitario: sparePart.costo_unitario.toString(),
              estado: String(sparePart.estado),
            }}
            submitLabel="Guardar cambios"
          />
        </CardContent>
      </Card>
    </main>
  );
}
