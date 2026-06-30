"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import {
  failureSchema,
  failureStatusSchema,
} from "@/schemas/maintenance/failure.schema";

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

function requireMaintenanceRole(role: string | undefined) {
  if (role !== APP_ROLES.ADMIN && role !== APP_ROLES.WORKSHOP_MASTER) {
    redirect("/dashboard/access-denied");
  }
}

export async function createFailureAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireMaintenanceRole(session.user.role);

  const parsed = failureSchema.safeParse({
    id_maquina: formData.get("id_maquina"),
    fecha_falla: formData.get("fecha_falla"),
    descripcion: formData.get("descripcion"),
    responsable_registro: formData.get("responsable_registro") ?? "",
    estado_atencion: formData.get("estado_atencion"),
    tiempo_perdido_horas: formData.get("tiempo_perdido_horas") ?? "",
    impacto_produccion: formData.get("impacto_produccion") ?? "",
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

  const lastFailure = await prisma.falla_maquina.findFirst({
    orderBy: {
      id_falla: "desc",
    },
    select: {
      id_falla: true,
    },
  });

  const idFalla = buildSequentialId(lastFailure?.id_falla, "FAL");

  await prisma.falla_maquina.create({
    data: {
      id_falla: idFalla,
      id_maquina: data.id_maquina,
      id_usuario_registro: session.user.id,
      fecha_falla: data.fecha_falla,
      descripcion: data.descripcion,
      responsable_registro: data.responsable_registro || null,
      estado_atencion: data.estado_atencion,
      tiempo_perdido_horas: data.tiempo_perdido_horas,
      impacto_produccion: data.impacto_produccion || null,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "falla_maquina",
    id_registro_afectado: idFalla,
    accion: "crear",
    detalle: `Falla registrada para la maquina ${data.id_maquina}.`,
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/failures");
  revalidatePath("/dashboard/maintenance/machines");

  redirect("/dashboard/maintenance/failures");
}

export async function updateFailureStatusAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireMaintenanceRole(session.user.role);

  const parsed = failureStatusSchema.safeParse({
    id_falla: formData.get("id_falla"),
    estado_atencion: formData.get("estado_atencion"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const failure = await prisma.falla_maquina.findUnique({
    where: {
      id_falla: data.id_falla,
    },
    select: {
      id_falla: true,
    },
  });

  if (!failure) {
    throw new Error("La falla seleccionada no existe.");
  }

  await prisma.falla_maquina.update({
    where: {
      id_falla: data.id_falla,
    },
    data: {
      estado_atencion: data.estado_atencion,
    },
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/failures");

  redirect("/dashboard/maintenance/failures");
}
