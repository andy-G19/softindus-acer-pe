import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildMaterialItems, buildWorkOrderItems } from "@/modules/waste-scrap/form-options";
import { wasteScrapNotifications } from "@/modules/waste-scrap/notifications";
import { createReusableScrapAction } from "@/modules/waste-scrap/reusable-scraps/actions";
import { getNewReusableScrapFormOptions } from "@/modules/waste-scrap/reusable-scraps/queries";
import { ReusableScrapForm } from "@/modules/waste-scrap/reusable-scraps/reusable-scrap-form";

type NewReusableScrapPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewReusableScrapPage({ searchParams }: NewReusableScrapPageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.reusableScraps);
  const { materials, workOrders } = await getNewReusableScrapFormOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Registrar retazo reutilizable"
        description="Registra sobrantes aprovechables generados durante el corte o la producción. Estos retazos quedarán disponibles para reutilización futura dentro del taller."
        backHref={backHref}
        backLabel="Volver a retazos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mermas y chatarra", href: navigationHrefs.wasteScrap },
          { label: "Retazos reutilizables", href: navigationHrefs.reusableScraps },
          { label: "Nuevo retazo" },
        ])}
      />

      <ReusableScrapForm
        action={createReusableScrapAction}
        materials={buildMaterialItems(materials)}
        workOrders={buildWorkOrderItems(workOrders)}
        successNotification={wasteScrapNotifications["reusable-scrap-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
