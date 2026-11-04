import { RouteSheet } from "@/components/navigation/route-sheet";
import { requireRole } from "@/lib/authz";
import { getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createAttendanceAction } from "@/modules/staff/attendance/actions";
import { AttendanceForm } from "@/modules/staff/attendance/attendance-form";
import { newAttendanceFormValues, operatorOptions } from "@/modules/staff/attendance/attendance-form-values";
import { staffNotifications } from "@/modules/staff/notifications";
import { findActiveOperators } from "@/modules/staff/operators/queries";

type NewAttendancePanelProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Registro de asistencia en panel lateral (entrega 10.8a), interceptado desde el
// listado. Mismo formulario, consulta, accion y permisos que new/page.tsx.
export default async function NewAttendancePanel({ searchParams }: NewAttendancePanelProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const queryParams = (await searchParams) ?? {};
  const returnTo = getSafeReturnTo(queryParams.returnTo, navigationHrefs.attendance);
  const operators = await findActiveOperators();

  return (
    <RouteSheet
      title="Registrar asistencia"
      description="Fecha, horas de ingreso y salida, tardanza, falta y observaciones de un operario."
      discardTitle="¿Descartar la asistencia?"
      discardDescription="Se perderán los datos que escribiste en este panel."
    >
      <AttendanceForm
        action={createAttendanceAction}
        operators={operatorOptions(operators)}
        defaultValues={newAttendanceFormValues()}
        successNotification={staffNotifications["attendance-created"]}
        returnTo={returnTo}
      />
    </RouteSheet>
  );
}
