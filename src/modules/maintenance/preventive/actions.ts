"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import {
  preventiveMaintenanceSchema,
  preventiveMaintenanceStatusSchema,
} from "@/schemas/maintenance/preventive-maintenance.schema";

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

function requireAdmin(role: string | undefined) {
  if (role !== APP_ROLES.ADMIN) {
    redirect("/dashboard/access-denied");
  }
}

export async function createPreventiveMaintenanceAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = preventiveMaintenanceSchema.safeParse({
    id_maquina: formData.get("id_maquina"),
    fecha_programada: formData.get("fecha_programada"),
    responsable: formData.get("responsable") ?? "",
    actividad: formData.get("actividad"),
    estado: formData.get("estado"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const machine = await prisma.maquina.findUnique({
    where: {
      id_maquina: data.id_maquina,
    },
    select: {
      id_maquina: true,
    },
  });

  if (!machine) {
    throw new Error("La máquina seleccionada no existe.");
  }

  const lastMaintenance = await prisma.mantenimiento_preventivo.findFirst({
    orderBy: {
      id_mantenimiento: "desc",
    },
    select: {
      id_mantenimiento: true,
    },
  });

  const idMantenimiento = buildSequentialId(
    lastMaintenance?.id_mantenimiento,
    "MTP",
  );

  await prisma.mantenimiento_preventivo.create({
    data: {
      id_mantenimiento: idMantenimiento,
      id_maquina: data.id_maquina,
      id_usuario_programa: session.user.id,
      fecha_programada: data.fecha_programada,
      fecha_realizada:
        data.estado === "realizado" ? data.fecha_programada : null,
      responsable: data.responsable || null,
      actividad: data.actividad,
      estado: data.estado,
      observaciones: data.observaciones || null,
    },
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/preventive");
  revalidatePath("/dashboard/maintenance/machines");

  redirect("/dashboard/maintenance/preventive");
}

export async function updatePreventiveMaintenanceStatusAction(
  formData: FormData,
) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = preventiveMaintenanceStatusSchema.safeParse({
    id_mantenimiento: formData.get("id_mantenimiento"),
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const maintenance = await prisma.mantenimiento_preventivo.findUnique({
    where: {
      id_mantenimiento: data.id_mantenimiento,
    },
    select: {
      id_mantenimiento: true,
      fecha_programada: true,
    },
  });

  if (!maintenance) {
    throw new Error("El mantenimiento seleccionado no existe.");
  }

  await prisma.mantenimiento_preventivo.update({
    where: {
      id_mantenimiento: data.id_mantenimiento,
    },
    data: {
      estado: data.estado,
      fecha_realizada:
        data.estado === "realizado" ? new Date() : null,
    },
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/preventive");
  revalidatePath("/dashboard/maintenance/machines");

  redirect("/dashboard/maintenance/preventive");
}