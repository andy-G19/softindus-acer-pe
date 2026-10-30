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
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import { updateSparePartAction } from "@/modules/maintenance/spare-parts/actions";
import { getSparePartEditValues } from "@/modules/maintenance/spare-parts/spare-part-edit-values";
import { SparePartForm } from "@/modules/maintenance/spare-parts/spare-part-form";
import { getSparePartEditData } from "@/modules/maintenance/spare-parts/queries";
import { buildSparePartProviderOptions } from "@/modules/maintenance/spare-parts/spare-part-provider-options";

type EditSparePartPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditSparePartPage({
  params,
  searchParams,
}: EditSparePartPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const sparePartEditData = await getSparePartEditData(id);

  if (!sparePartEditData) {
    notFound();
  }

  const { sparePart, providers, supplierTypes } = sparePartEditData;
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.spareParts);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar repuesto"
        description="Actualiza datos maestros del repuesto sin tocar reparaciones."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Repuestos", href: backHref },
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
            providers={buildSparePartProviderOptions(providers)}
            supplierTypes={supplierTypes}
            defaultValues={getSparePartEditValues(sparePart)}
            submitLabel="Guardar cambios"
            successNotification={maintenanceNotifications["spare-part-updated"]}
            returnTo={backHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
