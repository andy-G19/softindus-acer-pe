import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { staffNotifications } from "@/modules/staff/notifications";
import { createOperatorTaskAction } from "@/modules/staff/tasks/actions";
import { getNewOperatorTaskFormOptions } from "@/modules/staff/tasks/queries";
import { TaskForm } from "@/modules/staff/tasks/task-form";
import { newTaskFormValues, taskFormOptions } from "@/modules/staff/tasks/task-form-values";

type NewOperatorTaskPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewOperatorTaskPage({ searchParams }: NewOperatorTaskPageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.tasks);
  const options = taskFormOptions(await getNewOperatorTaskFormOptions());

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Registrar tarea diaria"
        description="Asocia un operario con una orden de trabajo, una etapa productiva opcional, la fecha de actividad, descripción y horas dedicadas."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Tareas diarias", href: backHref },
          { label: "Nueva tarea" },
        ])}
        actions={<Badge>ADMIN / Maestro de taller</Badge>}
      />

      <TaskForm
        action={createOperatorTaskAction}
        {...options}
        defaultValues={newTaskFormValues()}
        successNotification={staffNotifications["operator-task-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
