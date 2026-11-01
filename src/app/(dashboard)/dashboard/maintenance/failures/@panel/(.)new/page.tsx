import { RouteSheet } from "@/components/navigation/route-sheet";
import { SheetBody } from "@/components/ui/sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createFailureAction } from "@/modules/maintenance/failures/actions";
import { FailureForm } from "@/modules/maintenance/failures/failure-form";
import { buildMachineOptionItems, getCurrentDateTimeValue } from "@/modules/maintenance/form-options";
import { findMachineOptions } from "@/modules/maintenance/machines/queries";
import { NoMachinesState } from "@/modules/maintenance/no-machines-state";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";

type NewFailurePanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de falla en panel lateral (entrega 10.5b), interceptada desde el
// listado. Mismo formulario, accion, permisos y consulta que new/page.tsx.
export default async function NewFailurePanel({ searchParams }: NewFailurePanelProps) {
  const session = await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.failures);
  const machines = await findMachineOptions();

  return (
    <RouteSheet
      title="Registrar falla de maquinaria"
      description="Documenta una falla tecnica de una maquina o equipo critico, registrando fecha, descripcion, responsable, tiempo perdido e impacto en produccion."
      discardTitle="¿Descartar la falla nueva?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      {machines.length === 0 ? (
        <SheetBody>
          <NoMachinesState
            description="Primero registra una maquina para poder documentar sus fallas."
            canRegisterMachine={session.user.role === APP_ROLES.ADMIN}
          />
        </SheetBody>
      ) : (
        <FailureForm
          action={createFailureAction}
          machines={buildMachineOptionItems(machines)}
          defaultValues={{ fecha_falla: getCurrentDateTimeValue(), estado_atencion: "pendiente" }}
          successNotification={maintenanceNotifications["failure-created"]}
          returnTo={returnTo}
        />
      )}
    </RouteSheet>
  );
}
