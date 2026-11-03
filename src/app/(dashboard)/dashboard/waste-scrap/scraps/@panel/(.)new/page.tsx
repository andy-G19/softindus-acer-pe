import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildMaterialItems, buildWorkOrderItems } from "@/modules/waste-scrap/form-options";
import { wasteScrapNotifications } from "@/modules/waste-scrap/notifications";
import { createScrapAction } from "@/modules/waste-scrap/scraps/actions";
import { getNewScrapFormOptions } from "@/modules/waste-scrap/scraps/queries";
import { ScrapForm } from "@/modules/waste-scrap/scraps/scrap-form";

type NewScrapPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de chatarra en panel lateral (entrega 10.7a), interceptada desde el listado.
// Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewScrapPanel({ searchParams }: NewScrapPanelProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.scraps);
  const { materials, workOrders } = await getNewScrapFormOptions();

  return (
    <RouteSheet
      title="Registrar chatarra generada"
      description="Registra sobrantes no reutilizables generados durante el corte, fabricación o limpieza del área productiva."
      discardTitle="¿Descartar la chatarra nueva?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <ScrapForm
        action={createScrapAction}
        materials={buildMaterialItems(materials)}
        workOrders={buildWorkOrderItems(workOrders)}
        successNotification={wasteScrapNotifications["scrap-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
