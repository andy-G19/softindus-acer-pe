"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { APP_ROLES } from "@/lib/permissions";
import { attendanceSchema } from "@/schemas/staff/attendance.schema";

const DUPLICATED_ATTENDANCE =
  "Este operario ya tiene asistencia registrada en la fecha seleccionada.";

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** Lo que el formulario de asistencia envio, para volver a mostrarlo. */
export type AttendanceFormValues = {
  id_operario: string;
  fecha: string;
  hora_ingreso: string;
  hora_salida: string;
  tardanza: boolean;
  falta: boolean;
  observaciones: string;
};

// Entrega 10.8a: el registro de asistencia se usa desde el panel lateral y devuelve
// el resultado; sin permiso responde con un error, no lanza ni redirige.
export type AttendanceFormState = FormActionState<AttendanceFormValues, { id_asistencia: string }>;

const ATTENDANCE_PATH = "/dashboard/staff/attendance";
const PERMISSION_ERROR = "No tienes permisos para registrar asistencia.";
const INVALID_DATA = "Revisa los datos de la asistencia.";
const INACTIVE_OPERATOR = "El operario seleccionado no existe o está inactivo.";

function getAttendanceFormValues(formData: FormData): AttendanceFormValues {
  const text = (name: string) => formData.get(name)?.toString() ?? "";

  return {
    id_operario: text("id_operario"),
    fecha: text("fecha"),
    hora_ingreso: text("hora_ingreso"),
    hora_salida: text("hora_salida"),
    tardanza: formData.get("tardanza") === "on",
    falta: formData.get("falta") === "on",
    observaciones: text("observaciones"),
  };
}

function attendanceError(
  values: AttendanceFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): AttendanceFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

/** Un rechazo de negocio y el campo que lo explica. */
type AttendanceProblem = { error: string; field: "id_operario" | "fecha" };

const duplicatedProblem: AttendanceProblem = { error: DUPLICATED_ATTENDANCE, field: "fecha" };

function timeStringToDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(`1970-01-01T${value}:00.000Z`);
}

function timeStringToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

function calculateWorkedHours(
  horaIngreso: string | null,
  horaSalida: string | null,
) {
  if (!horaIngreso || !horaSalida) {
    return null;
  }

  const ingreso = timeStringToMinutes(horaIngreso);
  const salida = timeStringToMinutes(horaSalida);
  const minutes = salida - ingreso;

  return minutes / 60;
}

export async function createAttendanceAction(
  _prevState: AttendanceFormState,
  formData: FormData,
): Promise<AttendanceFormState> {
  const values = getAttendanceFormValues(formData);
  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return attendanceError(values, PERMISSION_ERROR);
  }

  const parsed = attendanceSchema.safeParse(values);

  if (!parsed.success) {
    return attendanceError(values, INVALID_DATA, parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const workedHours = data.falta
    ? null
    : calculateWorkedHours(data.hora_ingreso, data.hora_salida);

  // Hallazgo 60: el operario y el duplicado se deciden dentro de la transaccion que
  // escribe; un rechazo se devuelve desde ella con el campo que lo explica. La
  // garantia es uq_asistencia_operario_fecha: si dos registros de la misma fecha
  // llegan a la vez, el segundo choca con ella (P2002) y responde como duplicado.
  let outcome: AttendanceProblem | { idAsistencia: string };

  try {
    outcome = await prisma.$transaction(
      async (tx): Promise<AttendanceProblem | { idAsistencia: string }> => {
        const operator = await tx.operario.findFirst({
          where: {
            id_operario: data.id_operario,
            estado: "activo",
          },
          select: {
            id_operario: true,
          },
        });

        if (!operator) {
          return { error: INACTIVE_OPERATOR, field: "id_operario" };
        }

        const duplicatedAttendance = await tx.asistencia.findFirst({
          where: {
            id_operario: data.id_operario,
            fecha: data.fecha,
          },
        });

        if (duplicatedAttendance) {
          return duplicatedProblem;
        }

        const idAsistencia = await getNextCorrelativeId(tx, {
          codigoEntidad: "asistencia",
          prefijo: "ASI",
        });

        await tx.asistencia.create({
          data: {
            id_asistencia: idAsistencia,
            id_operario: data.id_operario,
            id_usuario_registro: session.user.id,
            fecha: data.fecha,
            hora_ingreso: timeStringToDate(data.hora_ingreso),
            hora_salida: timeStringToDate(data.hora_salida),
            tardanza: data.falta ? false : data.tardanza,
            falta: data.falta,
            horas_trabajadas:
              workedHours === null ? null : workedHours.toFixed(2),
            observaciones: data.observaciones || null,
          },
        });

        await registerAuditLog({
          userId: session.user.id,
          entidad_afectada: "asistencia",
          id_registro_afectado: idAsistencia,
          accion: "crear",
          detalle: `Asistencia registrada para el operario ${data.id_operario}.`,
          tx,
        });

        return { idAsistencia };
      },
    );
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    outcome = duplicatedProblem;
  }

  if ("error" in outcome) {
    return attendanceError(values, outcome.error, { [outcome.field]: [outcome.error] });
  }

  revalidatePath("/dashboard/staff");
  revalidatePath(ATTENDANCE_PATH);

  return {
    status: "success",
    data: { id_asistencia: outcome.idAsistencia },
    values,
    operationId: newOperationId(),
  };
}
