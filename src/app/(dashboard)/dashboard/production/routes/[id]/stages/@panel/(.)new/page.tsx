import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { productionNotifications } from "@/modules/production/notifications";
import { createRouteStageAction } from "@/modules/production/stages/actions";
import { getNewRouteStageData } from "@/modules/production/stages/queries";
import { StageForm } from "@/modules/production/stages/stage-form";
import { NewStageNotices } from "@/modules/production/stages/stage-notices";

type NewStagePanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de etapa en panel lateral (entrega 10.6a), interceptada desde la lista de
// etapas. Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewStagePanel({ params, searchParams }: NewStagePanelProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  const { route, machines } = await getNewRouteStageData(id);

  if (!route) {
    notFound();
  }

  const suggestedOrder = (route.etapa_ruta[0]?.orden_secuencia ?? 0) + 1;
  const returnTo = getSafeReturnTo(queryParams.returnTo, `${navigationHrefs.routes}/${route.id_ruta}/stages`);

  return (
    <RouteSheet
      title="Nueva etapa de ruta"
      description={`Ruta: ${route.nombre_ruta} · Producto: ${route.producto.nombre_producto}`}
      discardTitle="¿Descartar la etapa nueva?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <StageForm
        action={createRouteStageAction}
        routeId={route.id_ruta}
        machines={machines}
        defaultValues={{ orden_secuencia: String(suggestedOrder) }}
        submitLabel="Registrar etapa"
        successNotification={productionNotifications["route-stage-created"]}
        returnTo={returnTo}
        notices={<NewStageNotices routeActive={route.estado} />}
        disabled={!route.estado}
      />
    </RouteSheet>
  );
}
