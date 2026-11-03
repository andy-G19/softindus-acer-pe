import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildMaterialItems, buildWorkOrderItems } from "@/modules/waste-scrap/form-options";
import { wasteScrapNotifications } from "@/modules/waste-scrap/notifications";
import { createScrapAction } from "@/modules/waste-scrap/scraps/actions";
import { getNewScrapFormOptions } from "@/modules/waste-scrap/scraps/queries";
import { ScrapForm } from "@/modules/waste-scrap/scraps/scrap-form";

type NewScrapPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewScrapPage({ searchParams }: NewScrapPageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.scraps);
  const { materials, workOrders } = await getNewScrapFormOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Registrar chatarra generada"
        description="Registra sobrantes no reutilizables generados durante el corte, fabricación o limpieza del área productiva. La chatarra quedará acumulada hasta que se registre su venta."
        backHref={backHref}
        backLabel="Volver a chatarra"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mermas y chatarra", href: navigationHrefs.wasteScrap },
          { label: "Chatarra", href: navigationHrefs.scraps },
          { label: "Nueva chatarra" },
        ])}
      />

      <ScrapForm
        action={createScrapAction}
        materials={buildMaterialItems(materials)}
        workOrders={buildWorkOrderItems(workOrders)}
        successNotification={wasteScrapNotifications["scrap-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
