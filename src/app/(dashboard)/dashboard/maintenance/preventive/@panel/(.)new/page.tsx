import { RouteSheet } from "@/components/navigation/route-sheet";
import { SheetBody } from "@/components/ui/sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildMachineOptionItems, getTodayValue } from "@/modules/maintenance/form-options";
import { findMachineOptions } from "@/modules/maintenance/machines/queries";
import { NoMachinesState } from "@/modules/maintenance/no-machines-state";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import { createPreventiveMaintenanceAction } from "@/modules/maintenance/preventive/actions";
import { PreventiveForm } from "@/modules/maintenance/preventive/preventive-form";

type NewPreventivePanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de preventivo en panel lateral (entrega 10.5b), interceptada desde el
// listado. Mismo formulario, accion, permisos y consulta que new/page.tsx.
export default async function NewPreventivePanel({ searchParams }: NewPreventivePanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.preventiveMaintenance);
  const machines = await findMachineOptions();

  return (
    <RouteSheet
      title="Programar mantenimiento preventivo"
      description="Programa actividades preventivas por maquina para anticipar fallas, reducir paradas imprevistas y mantener la continuidad del taller."
      discardTitle="¿Descartar el preventivo nuevo?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      {machines.length === 0 ? (
        <SheetBody>
          <NoMachinesState
            description="Primero registra una maquina para poder programar mantenimientos preventivos."
            canRegisterMachine
          />
        </SheetBody>
      ) : (
        <PreventiveForm
          action={createPreventiveMaintenanceAction}
          machines={buildMachineOptionItems(machines)}
          defaultValues={{ fecha_programada: getTodayValue(), estado: "pendiente" }}
          successNotification={maintenanceNotifications["preventive-maintenance-created"]}
          returnTo={returnTo}
        />
      )}
    </RouteSheet>
  );
}
