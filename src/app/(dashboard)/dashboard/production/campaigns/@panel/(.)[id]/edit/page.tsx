import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { updateProductionCampaignAction } from "@/modules/production/campaigns/actions";
import { CampaignForm } from "@/modules/production/campaigns/campaign-form";
import { campaignEditFormValues } from "@/modules/production/campaigns/campaign-form-values";
import { getProductionCampaignForEdit } from "@/modules/production/campaigns/queries";
import { productionNotifications } from "@/modules/production/notifications";

type EditCampaignPanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de campana en panel lateral (entrega 10.7a), interceptada desde el listado.
// Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditCampaignPanel({ params, searchParams }: EditCampaignPanelProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  const campaign = await getProductionCampaignForEdit(id);

  if (!campaign) {
    notFound();
  }

  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.campaigns);

  return (
    <RouteSheet
      title="Editar campaña"
      description={`${campaign.nombre_campania} · ${campaign.id_campania}`}
      discardTitle="¿Descartar los cambios de la campaña?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <CampaignForm
        action={updateProductionCampaignAction}
        defaultValues={campaignEditFormValues(campaign)}
        submitLabel="Guardar cambios"
        successNotification={productionNotifications["campaign-updated"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
