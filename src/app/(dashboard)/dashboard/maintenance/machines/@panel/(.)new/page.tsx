import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createMachineAction } from "@/modules/maintenance/machines/actions";
import { MachineForm } from "@/modules/maintenance/machines/machine-form";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";

type NewMachinePanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Alta de maquina en panel lateral (entrega 10.5a), interceptada desde el
// listado. Mismo formulario, accion y permisos que new/page.tsx.
export default async function NewMachinePanel({ searchParams }: NewMachinePanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.machines);

  return (
    <RouteSheet
      title="Registrar máquina"
      description="Registra una máquina o equipo crítico del taller para controlar su estado operativo, ubicación y código interno."
      discardTitle="¿Descartar la máquina nueva?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <MachineForm
        action={createMachineAction}
        defaultValues={{
          tipo: "prensa",
          estado: "operativa",
        }}
        submitLabel="Registrar maquina"
        successNotification={maintenanceNotifications["machine-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
