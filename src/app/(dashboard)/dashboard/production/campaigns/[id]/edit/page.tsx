import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { updateProductionCampaignAction } from "@/modules/production/campaigns/actions";
import { CampaignForm } from "@/modules/production/campaigns/campaign-form";
import { campaignEditFormValues } from "@/modules/production/campaigns/campaign-form-values";
import { getProductionCampaignForEdit } from "@/modules/production/campaigns/queries";
import { productionNotifications } from "@/modules/production/notifications";

type EditProductionCampaignPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditProductionCampaignPage({
  params,
  searchParams,
}: EditProductionCampaignPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  const campaign = await getProductionCampaignForEdit(id);

  if (!campaign) {
    notFound();
  }

  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.campaigns);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar campaña"
        description="Actualiza los datos generales de la campaña."
        backHref={backHref}
        backLabel="Volver a campañas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Campañas", href: backHref },
          { label: "Editar campaña" },
        ])}
      />

      <CampaignForm
        action={updateProductionCampaignAction}
        defaultValues={campaignEditFormValues(campaign)}
        submitLabel="Guardar cambios"
        successNotification={productionNotifications["campaign-updated"]}
        returnTo={backHref}
      />
    </div>
  );
}
