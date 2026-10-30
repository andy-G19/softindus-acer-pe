import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import { createSparePartAction } from "@/modules/maintenance/spare-parts/actions";
import { SparePartForm } from "@/modules/maintenance/spare-parts/spare-part-form";
import { buildSparePartProviderOptions } from "@/modules/maintenance/spare-parts/spare-part-provider-options";
import { getNewSparePartFormOptions } from "@/modules/maintenance/spare-parts/queries";

type NewSparePartPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de repuesto en panel lateral (entrega 10.5a), interceptada desde el
// listado. Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewSparePartPanel({ searchParams }: NewSparePartPanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.spareParts);
  const { providers, supplierTypes } = await getNewSparePartFormOptions();

  return (
    <RouteSheet
      title="Registrar repuesto"
      description="Registra repuestos disponibles para mantenimiento, proveedor, descripcion y costo unitario."
      discardTitle="¿Descartar el repuesto nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <SparePartForm
        action={createSparePartAction}
        providers={buildSparePartProviderOptions(providers)}
        supplierTypes={supplierTypes}
        defaultValues={{
          estado: "true",
        }}
        submitLabel="Registrar repuesto"
        successNotification={maintenanceNotifications["spare-part-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
