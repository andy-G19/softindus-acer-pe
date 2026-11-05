import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { staffNotifications } from "@/modules/staff/notifications";
import { createOperatorTaskAction } from "@/modules/staff/tasks/actions";
import { getNewOperatorTaskFormOptions } from "@/modules/staff/tasks/queries";
import { TaskForm } from "@/modules/staff/tasks/task-form";
import { newTaskFormValues, taskFormOptions } from "@/modules/staff/tasks/task-form-values";

type NewTaskPanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Registro de tarea en panel lateral (entrega 10.8a), interceptado desde el
// listado. Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewTaskPanel({ searchParams }: NewTaskPanelProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.tasks);
  const options = taskFormOptions(await getNewOperatorTaskFormOptions());

  return (
    <RouteSheet
      title="Registrar tarea"
      description="Qué hizo un operario durante la jornada, en qué orden y etapa, y cuántas horas le dedicó."
      discardTitle="¿Descartar la tarea?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <TaskForm
        action={createOperatorTaskAction}
        {...options}
        defaultValues={newTaskFormValues()}
        successNotification={staffNotifications["operator-task-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
