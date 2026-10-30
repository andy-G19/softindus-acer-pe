import { notFound } from "next/navigation";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateMachineAction } from "@/modules/maintenance/machines/actions";
import { getMachineEditValues } from "@/modules/maintenance/machines/machine-edit-values";
import { MachineForm } from "@/modules/maintenance/machines/machine-form";
import { getMachineForEdit } from "@/modules/maintenance/machines/queries";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";

type EditMachinePanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Edicion de maquina en panel lateral (entrega 10.5a), interceptada desde el
// listado. Misma consulta, formulario, accion y permisos que [id]/edit/page.tsx.
export default async function EditMachinePanel({ params, searchParams }: EditMachinePanelProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const machine = await getMachineForEdit(id);

  if (!machine) {
    notFound();
  }

  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.machines);

  return (
    <RouteSheet
      title="Editar máquina"
      description={`${machine.nombre} · ${machine.id_maquina}`}
      discardTitle="¿Descartar los cambios de la máquina?"
      discardDescription="Se perderán los cambios que hiciste en este panel."
    >
      <MachineForm
        action={updateMachineAction}
        defaultValues={getMachineEditValues(machine)}
        submitLabel="Guardar cambios"
        successNotification={maintenanceNotifications["machine-updated"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
