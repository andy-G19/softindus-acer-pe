import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { createProductionCampaignAction } from "@/modules/production/campaigns/actions";
import { CampaignForm } from "@/modules/production/campaigns/campaign-form";
import { newCampaignFormValues } from "@/modules/production/campaigns/campaign-form-values";
import { productionNotifications } from "@/modules/production/notifications";

type NewProductionCampaignPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewProductionCampaignPage({ searchParams }: NewProductionCampaignPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.campaigns);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nueva campaña de producción"
        description="Registra una campaña para agrupar objetivos de producción por producto y asociarla luego a órdenes de trabajo."
        backHref={backHref}
        backLabel="Volver a campañas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Campañas", href: backHref },
          { label: "Nueva campaña" },
        ])}
      />

      <CampaignForm
        action={createProductionCampaignAction}
        defaultValues={newCampaignFormValues()}
        submitLabel="Guardar campaña"
        successNotification={productionNotifications["campaign-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
