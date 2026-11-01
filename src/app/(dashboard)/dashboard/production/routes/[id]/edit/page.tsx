import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { updateFabricationRouteAction } from "@/modules/production/routes/actions";
import { getFabricationRouteEditData } from "@/modules/production/routes/queries";
import { getRouteEditFormProps } from "@/modules/production/routes/route-edit-props";
import { RouteForm } from "@/modules/production/routes/route-form";

type EditFabricationRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditFabricationRoutePage({
  params,
  searchParams,
}: EditFabricationRoutePageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  const { route, products } = await getFabricationRouteEditData(id);

  if (!route) {
    notFound();
  }

  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.routes);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar ruta de fabricación"
        description="Actualiza los datos generales de la ruta. Si ya tiene órdenes asociadas, el producto queda protegido para conservar trazabilidad."
        backHref={backHref}
        backLabel="Volver a rutas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: backHref },
          { label: "Editar ruta" },
        ])}
      />

      <RouteForm
        action={updateFabricationRouteAction}
        {...getRouteEditFormProps(route, products)}
        submitLabel="Guardar cambios"
        successNotification={productionNotifications["route-updated"]}
        returnTo={backHref}
      />
    </div>
  );
}
