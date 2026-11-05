import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createAttendanceAction } from "@/modules/staff/attendance/actions";
import { AttendanceForm } from "@/modules/staff/attendance/attendance-form";
import { newAttendanceFormValues, operatorOptions } from "@/modules/staff/attendance/attendance-form-values";
import { staffNotifications } from "@/modules/staff/notifications";
import { findActiveOperators } from "@/modules/staff/operators/queries";

type NewAttendancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewAttendancePage({ searchParams }: NewAttendancePageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const backHref = getSafeReturnTo(queryParams.returnTo, navigationHrefs.attendance);
  const operators = await findActiveOperators();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Registrar asistencia diaria"
        description="Registra la asistencia de un operario indicando fecha, hora de ingreso, hora de salida, tardanza, falta y observaciones."
        backHref={backHref}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Asistencia", href: backHref },
          { label: "Nueva asistencia" },
        ])}
        actions={<Badge>ADMIN / Maestro de taller</Badge>}
      />

      <AttendanceForm
        action={createAttendanceAction}
        operators={operatorOptions(operators)}
        defaultValues={newAttendanceFormValues()}
        successNotification={staffNotifications["attendance-created"]}
        returnTo={backHref}
      />
    </div>
  );
}
