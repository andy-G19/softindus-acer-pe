"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import {
  reassignWorkOrderProgressSchema,
  updateWorkOrderProgressSchema,
} from "@/schemas/production/work-order-progress.schema";

function requireProductionManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function buildSequentialId(
  lastId: string | null | undefined,
  prefix: string,
  offset = 1,
) {
  if (!lastId) {
    return `${prefix}${String(offset).padStart(8, "0")}`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));

  if (Number.isNaN(currentNumber)) {
    return `${prefix}${String(offset).padStart(8, "0")}`;
  }

  const nextNumber = currentNumber + offset;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function normalizeProgressPercentage(
  estadoEtapa: string,
  porcentajeAvance: number,
) {
  if (estadoEtapa === "pendiente") {
    return 0;
  }

  if (estadoEtapa === "terminada") {
    return 100;
  }

  if (porcentajeAvance <= 0) {
    return 1;
  }

  if (porcentajeAvance >= 100) {
    return 99;
  }

  return porcentajeAvance;
}

async function syncWorkOrderStatus(idOrdenTrabajo: string) {
  const advances = await prisma.avance_orden.findMany({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    select: {
      estado_etapa: true,
    },
  });

  if (advances.length === 0) {
    await prisma.orden_trabajo.update({
      where: {
        id_orden_trabajo: idOrdenTrabajo,
      },
      data: {
        estado: "pendiente",
        fecha_entrega_real: null,
      },
    });

    return;
  }

  const allFinished = advances.every(
    (advance) => advance.estado_etapa === "terminada",
  );

  const hasInProgress = advances.some(
    (advance) => advance.estado_etapa === "en_proceso",
  );

  const hasPaused = advances.some(
    (advance) => advance.estado_etapa === "pausada",
  );

  if (allFinished) {
    await prisma.orden_trabajo.update({
      where: {
        id_orden_trabajo: idOrdenTrabajo,
      },
      data: {
        estado: "finalizada",
        fecha_entrega_real: new Date(),
      },
    });

    return;
  }

  if (hasInProgress) {
    await prisma.orden_trabajo.update({
      where: {
        id_orden_trabajo: idOrdenTrabajo,
      },
      data: {
        estado: "en_proceso",
        fecha_entrega_real: null,
      },
    });

    return;
  }

  if (hasPaused) {
    await prisma.orden_trabajo.update({
      where: {
        id_orden_trabajo: idOrdenTrabajo,
      },
      data: {
        estado: "pausada",
        fecha_entrega_real: null,
      },
    });

    return;
  }

  await prisma.orden_trabajo.update({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    data: {
      estado: "pendiente",
      fecha_entrega_real: null,
    },
  });
}

export async function generateWorkOrderProgressAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "");

  if (!idOrdenTrabajo) {
    throw new Error("No se recibió la orden de trabajo.");
  }

  const workOrder = await prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    include: {
      ruta_fabricacion: {
        include: {
          etapa_ruta: {
            where: {
              estado: true,
            },
            orderBy: {
              orden_secuencia: "asc",
            },
          },
        },
      },
      avance_orden: true,
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (workOrder.estado === "anulada" || workOrder.estado === "finalizada") {
    throw new Error(
      "No se pueden generar avances para una orden anulada o finalizada.",
    );
  }

  if (!workOrder.ruta_fabricacion) {
    throw new Error("La orden no tiene una ruta de fabricación asociada.");
  }

  if (workOrder.ruta_fabricacion.etapa_ruta.length === 0) {
    throw new Error("La ruta asociada no tiene etapas activas.");
  }

  if (workOrder.avance_orden.length > 0) {
    throw new Error("Esta orden ya tiene avances generados.");
  }

  const lastAdvance = await prisma.avance_orden.findFirst({
    orderBy: {
      id_avance: "desc",
    },
    select: {
      id_avance: true,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.avance_orden.createMany({
      data: workOrder.ruta_fabricacion!.etapa_ruta.map((stage, index) => ({
        id_avance: buildSequentialId(lastAdvance?.id_avance, "AVN", index + 1),
        id_orden_trabajo: workOrder.id_orden_trabajo,
        id_etapa_ruta: stage.id_etapa_ruta,
        estado_etapa: "pendiente",
        porcentaje_avance: 0,
        id_usuario_actualiza: session.user.id,
      })),
    });

    await tx.orden_trabajo.update({
      where: {
        id_orden_trabajo: workOrder.id_orden_trabajo,
      },
      data: {
        estado: "pendiente",
      },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}/progress`);

  redirect(`/dashboard/production/work-orders/${idOrdenTrabajo}/progress`);
}

export async function updateWorkOrderProgressAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = updateWorkOrderProgressSchema.safeParse({
    id_avance: formData.get("id_avance"),
    estado_etapa: formData.get("estado_etapa"),
    porcentaje_avance: formData.get("porcentaje_avance"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const advance = await prisma.avance_orden.findUnique({
    where: {
      id_avance: data.id_avance,
    },
    include: {
      orden_trabajo: true,
    },
  });

  if (!advance) {
    throw new Error("El avance seleccionado no existe.");
  }

  if (
    advance.orden_trabajo.estado === "anulada" ||
    advance.orden_trabajo.estado === "finalizada"
  ) {
    throw new Error(
      "No se puede modificar el avance de una orden anulada o finalizada.",
    );
  }

  const now = new Date();
  const normalizedPercentage = normalizeProgressPercentage(
    data.estado_etapa,
    data.porcentaje_avance,
  );

  const nextStartDate =
    data.estado_etapa === "en_proceso" ||
    data.estado_etapa === "pausada" ||
    data.estado_etapa === "terminada"
      ? advance.fecha_inicio_etapa ?? now
      : null;

  const nextEndDate =
    data.estado_etapa === "terminada"
      ? advance.fecha_fin_etapa ?? now
      : null;

  await prisma.avance_orden.update({
    where: {
      id_avance: data.id_avance,
    },
    data: {
      id_operario: advance.id_operario,
      estado_etapa: data.estado_etapa,
      porcentaje_avance: normalizedPercentage,
      fecha_inicio_etapa: nextStartDate,
      fecha_fin_etapa: nextEndDate,
      observaciones: data.observaciones,
      id_usuario_actualiza: session.user.id,
    },
  });

  await syncWorkOrderStatus(advance.id_orden_trabajo);

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "avance_orden",
    id_registro_afectado: data.id_avance,
    accion: "actualizar",
    detalle: `Avance actualizado a ${data.estado_etapa} (${normalizedPercentage}%).`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${advance.id_orden_trabajo}`);
  revalidatePath(
    `/dashboard/production/work-orders/${advance.id_orden_trabajo}/progress`,
  );

  redirect(`/dashboard/production/work-orders/${advance.id_orden_trabajo}/progress`);
}

export async function reassignWorkOrderProgressAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = reassignWorkOrderProgressSchema.safeParse({
    id_avance: formData.get("id_avance"),
    id_operario_nuevo: formData.get("id_operario_nuevo"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  const [advance, newOperator, lastReassignment] = await Promise.all([
    prisma.avance_orden.findUnique({
      where: {
        id_avance: data.id_avance,
      },
      include: {
        etapa_ruta: true,
        operario: true,
        orden_trabajo: true,
      },
    }),

    prisma.operario.findFirst({
      where: {
        id_operario: data.id_operario_nuevo,
        estado: "activo",
      },
      select: {
        id_operario: true,
        nombres: true,
        apellidos: true,
      },
    }),

    prisma.reasignacion_tarea.findFirst({
      orderBy: {
        id_reasignacion: "desc",
      },
      select: {
        id_reasignacion: true,
      },
    }),
  ]);

  if (!advance) {
    throw new Error("El avance seleccionado no existe.");
  }

  if (
    advance.orden_trabajo.estado === "anulada" ||
    advance.orden_trabajo.estado === "finalizada"
  ) {
    throw new Error(
      "No se puede reasignar el avance de una orden anulada o finalizada.",
    );
  }

  if (!newOperator) {
    throw new Error("El nuevo operario no existe o esta inactivo.");
  }

  if (advance.id_operario === newOperator.id_operario) {
    throw new Error("El nuevo operario debe ser distinto al operario actual.");
  }

  const idReasignacion = buildNextId(
    "REA",
    lastReassignment?.id_reasignacion,
  );
  const reassignmentDate = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.reasignacion_tarea.create({
      data: {
        id_reasignacion: idReasignacion,
        id_avance: advance.id_avance,
        id_operario_anterior: advance.id_operario,
        id_operario_nuevo: newOperator.id_operario,
        motivo: data.motivo,
        fecha_reasignacion: reassignmentDate,
        id_usuario_responsable: session.user.id,
      },
    });

    await tx.avance_orden.update({
      where: {
        id_avance: advance.id_avance,
      },
      data: {
        id_operario: newOperator.id_operario,
        id_usuario_actualiza: session.user.id,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "reasignacion_tarea",
      id_registro_afectado: idReasignacion,
      accion: "crear",
      detalle: `Avance ${advance.id_avance} reasignado a ${newOperator.apellidos}, ${newOperator.nombres}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${advance.id_orden_trabajo}`);
  revalidatePath(
    `/dashboard/production/work-orders/${advance.id_orden_trabajo}/progress`,
  );
  revalidatePath(
    `/dashboard/production/work-orders/${advance.id_orden_trabajo}/progress/${advance.id_avance}/reassign`,
  );

  redirect(`/dashboard/production/work-orders/${advance.id_orden_trabajo}/progress`);
}

