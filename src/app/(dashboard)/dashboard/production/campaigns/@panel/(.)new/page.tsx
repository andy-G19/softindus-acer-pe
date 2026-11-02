import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { createProductionCampaignAction } from "@/modules/production/campaigns/actions";
import { CampaignForm } from "@/modules/production/campaigns/campaign-form";
import { newCampaignFormValues } from "@/modules/production/campaigns/campaign-form-values";
import { productionNotifications } from "@/modules/production/notifications";

type NewCampaignPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de campana en panel lateral (entrega 10.7a), interceptada desde el listado.
// Mismo formulario, accion y permisos que new/page.tsx.
export default async function NewCampaignPanel({ searchParams }: NewCampaignPanelProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.campaigns);

  return (
    <RouteSheet
      title="Nueva campaña de producción"
      description="Registra una campaña para agrupar objetivos de producción por producto y asociarla luego a órdenes de trabajo."
      discardTitle="¿Descartar la campaña nueva?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <CampaignForm
        action={createProductionCampaignAction}
        defaultValues={newCampaignFormValues()}
        submitLabel="Guardar campaña"
        successNotification={productionNotifications["campaign-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
