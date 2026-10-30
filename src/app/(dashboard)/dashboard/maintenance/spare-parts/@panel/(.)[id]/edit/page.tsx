import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import { updateSparePartAction } from "@/modules/maintenance/spare-parts/actions";
import { getSparePartEditValues } from "@/modules/maintenance/spare-parts/spare-part-edit-values";
import { SparePartForm } from "@/modules/maintenance/spare-parts/spare-part-form";
import { buildSparePartProviderOptions } from "@/modules/maintenance/spare-parts/spare-part-provider-options";
import { getSparePartEditData } from "@/modules/maintenance/spare-parts/queries";

type EditSparePartPanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de repuesto en panel lateral (entrega 10.5a), interceptada desde el
// listado. Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditSparePartPanel({ params, searchParams }: EditSparePartPanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const sparePartEditData = await getSparePartEditData(id);

  if (!sparePartEditData) {
    notFound();
  }

  const { sparePart, providers, supplierTypes } = sparePartEditData;
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.spareParts);

  return (
    <RouteSheet
      title="Editar repuesto"
      description={`${sparePart.nombre_repuesto} · ${sparePart.id_repuesto}`}
      discardTitle="¿Descartar los cambios del repuesto?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <SparePartForm
        action={updateSparePartAction}
        providers={buildSparePartProviderOptions(providers)}
        supplierTypes={supplierTypes}
        defaultValues={getSparePartEditValues(sparePart)}
        submitLabel="Guardar cambios"
        successNotification={maintenanceNotifications["spare-part-updated"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
