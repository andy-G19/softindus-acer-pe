"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { attendanceSchema } from "@/schemas/staff/attendance.schema";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));

  if (Number.isNaN(currentNumber)) {
    return `${prefix}00000001`;
  }

  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function requireStaffManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

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

export async function createAttendanceAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireStaffManager(session.user.role);

  const parsed = attendanceSchema.safeParse({
    id_operario: formData.get("id_operario"),
    fecha: formData.get("fecha"),
    hora_ingreso: formData.get("hora_ingreso") ?? "",
    hora_salida: formData.get("hora_salida") ?? "",
    tardanza: formData.get("tardanza"),
    falta: formData.get("falta"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const operator = await prisma.operario.findFirst({
    where: {
      id_operario: data.id_operario,
      estado: "activo",
    },
    select: {
      id_operario: true,
    },
  });

  if (!operator) {
    throw new Error("El operario seleccionado no existe o está inactivo.");
  }

  const duplicatedAttendance = await prisma.asistencia.findFirst({
    where: {
      id_operario: data.id_operario,
      fecha: data.fecha,
    },
  });

  if (duplicatedAttendance) {
    throw new Error(
      "Este operario ya tiene asistencia registrada en la fecha seleccionada.",
    );
  }

  const lastAttendance = await prisma.asistencia.findFirst({
    orderBy: {
      id_asistencia: "desc",
    },
    select: {
      id_asistencia: true,
    },
  });

  const idAsistencia = buildSequentialId(
    lastAttendance?.id_asistencia,
    "ASI",
  );

  const workedHours = data.falta
    ? null
    : calculateWorkedHours(data.hora_ingreso, data.hora_salida);

  await prisma.asistencia.create({
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

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/attendance");

  redirect("/dashboard/staff/attendance");
}