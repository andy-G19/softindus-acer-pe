import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { updateRouteStageAction } from "@/modules/production/stages/actions";
import { getRouteStageEditData } from "@/modules/production/stages/queries";
import { getStageEditValues } from "@/modules/production/stages/stage-edit-values";
import { StageForm } from "@/modules/production/stages/stage-form";
import { EditStageNotices } from "@/modules/production/stages/stage-notices";

type EditRouteStagePageProps = {
  params: Promise<{
    id: string;
    stageId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditRouteStagePage({
  params,
  searchParams,
}: EditRouteStagePageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, stageId } = await params;
  const queryParams = (await searchParams) ?? {};

  const routeStageEditData = await getRouteStageEditData(id, stageId);

  if (!routeStageEditData) {
    notFound();
  }

  const { stage, machines } = routeStageEditData;
  const backHref = getSafeReturnTo(queryParams.returnTo, `${navigationHrefs.routes}/${stage.id_ruta}/stages`);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar etapa de ruta"
        description={`Ruta: ${stage.ruta_fabricacion.nombre_ruta} · Producto: ${stage.ruta_fabricacion.producto.nombre_producto}`}
        backHref={backHref}
        backLabel="Volver a etapas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: navigationHrefs.routes },
          { label: "Etapas", href: backHref },
          { label: "Editar etapa" },
        ])}
      />

      <StageForm
        action={updateRouteStageAction}
        routeId={stage.id_ruta}
        machines={machines}
        defaultValues={getStageEditValues(stage)}
        submitLabel="Guardar cambios"
        successNotification={productionNotifications["route-stage-updated"]}
        returnTo={backHref}
        notices={<EditStageNotices stage={stage} />}
      />
    </div>
  );
}
