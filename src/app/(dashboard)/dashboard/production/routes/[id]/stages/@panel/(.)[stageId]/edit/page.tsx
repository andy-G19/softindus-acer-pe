import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { updateRouteStageAction } from "@/modules/production/stages/actions";
import { getRouteStageEditData } from "@/modules/production/stages/queries";
import { getStageEditValues } from "@/modules/production/stages/stage-edit-values";
import { StageForm } from "@/modules/production/stages/stage-form";
import { EditStageNotices } from "@/modules/production/stages/stage-notices";

type EditStagePanelProps = {
  params: Promise<{ id: string; stageId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de etapa en panel lateral (entrega 10.6a), interceptada desde la lista de
// etapas. Misma consulta, formulario, accion y permisos que [stageId]/edit/page.tsx.
export default async function EditStagePanel({ params, searchParams }: EditStagePanelProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, stageId } = await params;
  const queryParams = (await searchParams) ?? {};

  const routeStageEditData = await getRouteStageEditData(id, stageId);

  if (!routeStageEditData) {
    notFound();
  }

  const { stage, machines } = routeStageEditData;
  const returnTo = getSafeReturnTo(queryParams.returnTo, `${navigationHrefs.routes}/${stage.id_ruta}/stages`);

  return (
    <RouteSheet
      title="Editar etapa de ruta"
      description={`${stage.nombre_etapa} · Ruta: ${stage.ruta_fabricacion.nombre_ruta}`}
      discardTitle="¿Descartar los cambios de la etapa?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <StageForm
        action={updateRouteStageAction}
        routeId={stage.id_ruta}
        machines={machines}
        defaultValues={getStageEditValues(stage)}
        submitLabel="Guardar cambios"
        successNotification={productionNotifications["route-stage-updated"]}
        returnTo={returnTo}
        notices={<EditStageNotices stage={stage} />}
      />
    </RouteSheet>
  );
}
