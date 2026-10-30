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
import { createSparePartAction } from "@/modules/maintenance/spare-parts/actions";
import { SparePartForm } from "@/modules/maintenance/spare-parts/spare-part-form";
import { buildSparePartProviderOptions } from "@/modules/maintenance/spare-parts/spare-part-provider-options";
import { getNewSparePartFormOptions } from "@/modules/maintenance/spare-parts/queries";

type NewSparePartPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewSparePartPage({ searchParams }: NewSparePartPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.spareParts);
  const { providers, supplierTypes } = await getNewSparePartFormOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar repuesto"
        description="Registra repuestos disponibles para mantenimiento, proveedor, descripcion y costo unitario."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Repuestos", href: backHref },
          { label: "Nuevo repuesto" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos principales</CardTitle>
        </CardHeader>
        <CardContent>
          <SparePartForm
            action={createSparePartAction}
            providers={buildSparePartProviderOptions(providers)}
            supplierTypes={supplierTypes}
            defaultValues={{
              estado: "true",
            }}
            submitLabel="Registrar repuesto"
            successNotification={maintenanceNotifications["spare-part-created"]}
            returnTo={backHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
