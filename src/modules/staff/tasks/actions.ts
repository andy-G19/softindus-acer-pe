"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { operatorTaskSchema } from "@/schemas/staff/operator-task.schema";

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

export async function createOperatorTaskAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireStaffManager(session.user.role);

  const parsed = operatorTaskSchema.safeParse({
    id_operario: formData.get("id_operario"),
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    id_etapa_ruta: formData.get("id_etapa_ruta") ?? "",
    fecha_tarea: formData.get("fecha_tarea"),
    descripcion: formData.get("descripcion"),
    horas_dedicadas: formData.get("horas_dedicadas") ?? "",
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
  const selectedStageId = data.id_etapa_ruta || null;

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

  const workOrder = await prisma.orden_trabajo.findFirst({
    where: {
      id_orden_trabajo: data.id_orden_trabajo,
      estado: {
        not: "anulada",
      },
    },
    select: {
      id_orden_trabajo: true,
      id_ruta: true,
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo seleccionada no existe o está anulada.");
  }

  if (selectedStageId) {
    const selectedStage = await prisma.etapa_ruta.findUnique({
      where: {
        id_etapa_ruta: selectedStageId,
      },
      select: {
        id_etapa_ruta: true,
        id_ruta: true,
        estado: true,
      },
    });

    if (!selectedStage || !selectedStage.estado) {
      throw new Error("La etapa seleccionada no existe o está inactiva.");
    }

    if (!workOrder.id_ruta) {
      throw new Error(
        "La orden de trabajo seleccionada no tiene una ruta de fabricación asignada.",
      );
    }

    if (selectedStage.id_ruta !== workOrder.id_ruta) {
      throw new Error(
        "La etapa seleccionada no pertenece a la ruta de fabricación de la orden.",
      );
    }
  }

  const lastTask = await prisma.tarea_operario.findFirst({
    orderBy: {
      id_tarea_operario: "desc",
    },
    select: {
      id_tarea_operario: true,
    },
  });

  const idTareaOperario = buildSequentialId(
    lastTask?.id_tarea_operario,
    "TAR",
  );

  await prisma.tarea_operario.create({
    data: {
      id_tarea_operario: idTareaOperario,
      id_operario: data.id_operario,
      id_orden_trabajo: data.id_orden_trabajo,
      id_etapa_ruta: selectedStageId,
      id_usuario_registro: session.user.id,
      fecha_tarea: data.fecha_tarea,
      descripcion: data.descripcion,
      horas_dedicadas:
        data.horas_dedicadas === null
          ? null
          : data.horas_dedicadas.toFixed(2),
      estado: data.estado,
      observaciones: data.observaciones || null,
    },
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/tasks");

  redirect("/dashboard/staff/tasks");
}

export async function cancelOperatorTaskAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireStaffManager(session.user.role);

  const idTareaOperario = String(formData.get("id_tarea_operario") ?? "");

  if (!idTareaOperario) {
    throw new Error("No se recibió la tarea del operario.");
  }

  const task = await prisma.tarea_operario.findUnique({
    where: {
      id_tarea_operario: idTareaOperario,
    },
    select: {
      id_tarea_operario: true,
      estado: true,
    },
  });

  if (!task) {
    throw new Error("La tarea seleccionada no existe.");
  }

  if (task.estado === "anulada") {
    throw new Error("La tarea ya se encuentra anulada.");
  }

  await prisma.tarea_operario.update({
    where: {
      id_tarea_operario: idTareaOperario,
    },
    data: {
      estado: "anulada",
    },
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/tasks");

  redirect("/dashboard/staff/tasks");
}