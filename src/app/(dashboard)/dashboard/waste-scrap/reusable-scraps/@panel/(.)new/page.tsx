import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildMaterialItems, buildWorkOrderItems } from "@/modules/waste-scrap/form-options";
import { wasteScrapNotifications } from "@/modules/waste-scrap/notifications";
import { createReusableScrapAction } from "@/modules/waste-scrap/reusable-scraps/actions";
import { getNewReusableScrapFormOptions } from "@/modules/waste-scrap/reusable-scraps/queries";
import { ReusableScrapForm } from "@/modules/waste-scrap/reusable-scraps/reusable-scrap-form";

type NewReusableScrapPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de retazo en panel lateral (entrega 10.7a), interceptada desde el listado.
// Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewReusableScrapPanel({ searchParams }: NewReusableScrapPanelProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.reusableScraps);
  const { materials, workOrders } = await getNewReusableScrapFormOptions();

  return (
    <RouteSheet
      title="Registrar retazo reutilizable"
      description="Registra sobrantes aprovechables generados durante el corte o la producción."
      discardTitle="¿Descartar el retazo nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <ReusableScrapForm
        action={createReusableScrapAction}
        materials={buildMaterialItems(materials)}
        workOrders={buildWorkOrderItems(workOrders)}
        successNotification={wasteScrapNotifications["reusable-scrap-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
