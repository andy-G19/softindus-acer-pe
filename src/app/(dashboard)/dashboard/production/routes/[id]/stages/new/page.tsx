import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { createRouteStageAction } from "@/modules/production/stages/actions";
import { getNewRouteStageData } from "@/modules/production/stages/queries";
import { StageForm } from "@/modules/production/stages/stage-form";
import { NewStageNotices } from "@/modules/production/stages/stage-notices";

type NewRouteStagePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewRouteStagePage({
  params,
  searchParams,
}: NewRouteStagePageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  const { route, machines } = await getNewRouteStageData(id);

  if (!route) {
    notFound();
  }

  const suggestedOrder = (route.etapa_ruta[0]?.orden_secuencia ?? 0) + 1;
  const backHref = getSafeReturnTo(queryParams.returnTo, `${navigationHrefs.routes}/${route.id_ruta}/stages`);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nueva etapa de ruta"
        description={`Ruta: ${route.nombre_ruta} · Producto: ${route.producto.nombre_producto}`}
        backHref={backHref}
        backLabel="Volver a etapas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: navigationHrefs.routes },
          { label: "Etapas", href: backHref },
          { label: "Nueva etapa" },
        ])}
      />

      <StageForm
        action={createRouteStageAction}
        routeId={route.id_ruta}
        machines={machines}
        defaultValues={{ orden_secuencia: String(suggestedOrder) }}
        submitLabel="Registrar etapa"
        successNotification={productionNotifications["route-stage-created"]}
        returnTo={backHref}
        notices={<NewStageNotices routeActive={route.estado} />}
        disabled={!route.estado}
      />
    </div>
  );
}
