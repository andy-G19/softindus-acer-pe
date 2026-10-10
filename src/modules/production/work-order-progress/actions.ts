"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { lockWorkOrderRow } from "@/lib/row-locks";
import {
  reassignWorkOrderProgressSchema,
  updateWorkOrderProgressSchema,
} from "@/schemas/production/work-order-progress.schema";

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

// Recibe el cliente de la transaccion de quien lo llama, que ya bloqueo la orden (H8):
// lee los avances y escribe el estado con lo confirmado por las demas operaciones.
async function syncWorkOrderStatus(
  tx: Prisma.TransactionClient,
  idOrdenTrabajo: string,
) {
  const advances = await tx.avance_orden.findMany({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    select: {
      estado_etapa: true,
    },
  });

  if (advances.length === 0) {
    await tx.orden_trabajo.update({
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
    await tx.orden_trabajo.update({
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
    await tx.orden_trabajo.update({
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
    await tx.orden_trabajo.update({
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

  await tx.orden_trabajo.update({
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
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "");

  if (!idOrdenTrabajo) {
    throw new Error("No se recibió la orden de trabajo.");
  }

  await prisma.$transaction(async (tx) => {
    // H8: la orden se bloquea antes de leerla. Un doble envio generaba dos juegos de
    // etapas, y una anulacion simultanea quedaba pisada por el estado pendiente.
    await lockWorkOrderRow(tx, idOrdenTrabajo);

    const workOrder = await tx.orden_trabajo.findUnique({
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

    const advanceIds = await getNextCorrelativeIds(tx, {
      codigoEntidad: "avance_orden",
      prefijo: "AVN",
      cantidad: workOrder.ruta_fabricacion!.etapa_ruta.length,
    });

    await tx.avance_orden.createMany({
      data: workOrder.ruta_fabricacion!.etapa_ruta.map((stage, index) => ({
        id_avance: advanceIds[index],
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

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress?toast=work-order-progress-generated`,
  );
}

export async function updateWorkOrderProgressAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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

  // H8: el avance, la sincronizacion del estado de la orden y la bitacora van en una sola
  // transaccion, con la orden bloqueada. Antes eran escrituras sueltas: una actualizacion
  // simultanea con una anulacion devolvia la orden a en proceso, y una falla a mitad
  // dejaba el avance cambiado y la orden sin sincronizar.
  const idOrdenTrabajo = await prisma.$transaction(async (tx) => {
    const located = await tx.avance_orden.findUnique({
      where: {
        id_avance: data.id_avance,
      },
      select: {
        id_orden_trabajo: true,
      },
    });

    if (!located) {
      throw new Error("El avance seleccionado no existe.");
    }

    // El avance nunca cambia de orden: basta su id para saber que fila bloquear antes
    // de leer lo que decide.
    await lockWorkOrderRow(tx, located.id_orden_trabajo);

    const advance = await tx.avance_orden.findUnique({
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

    await tx.avance_orden.update({
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

    await syncWorkOrderStatus(tx, advance.id_orden_trabajo);

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "avance_orden",
      id_registro_afectado: data.id_avance,
      accion: "actualizar",
      detalle: `Avance actualizado a ${data.estado_etapa} (${normalizedPercentage}%).`,
      tx,
    });

    return advance.id_orden_trabajo;
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
  revalidatePath(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress`,
  );

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress?toast=work-order-progress-updated`,
  );
}

export async function reassignWorkOrderProgressAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = reassignWorkOrderProgressSchema.safeParse({
    id_avance: formData.get("id_avance"),
    id_operario_nuevo: formData.get("id_operario_nuevo"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  // H8: la reasignacion decide con la orden bloqueada. Un doble envio registraba dos
  // reasignaciones, y se podia reasignar en una orden que se estaba anulando.
  const { idOrdenTrabajo, idAvance } = await prisma.$transaction(async (tx) => {
    const located = await tx.avance_orden.findUnique({
      where: {
        id_avance: data.id_avance,
      },
      select: {
        id_orden_trabajo: true,
      },
    });

    if (!located) {
      throw new Error("El avance seleccionado no existe.");
    }

    // El avance nunca cambia de orden: basta su id para saber que fila bloquear antes
    // de leer lo que decide.
    await lockWorkOrderRow(tx, located.id_orden_trabajo);

    const [advance, newOperator] = await Promise.all([
      tx.avance_orden.findUnique({
        where: {
          id_avance: data.id_avance,
        },
        include: {
          etapa_ruta: true,
          operario: true,
          orden_trabajo: true,
        },
      }),

      tx.operario.findFirst({
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

    const reassignmentDate = new Date();

    const idReasignacion = await getNextCorrelativeId(tx, {
      codigoEntidad: "reasignacion_tarea",
      prefijo: "REA",
    });

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

    return { idOrdenTrabajo: advance.id_orden_trabajo, idAvance: advance.id_avance };
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
  revalidatePath(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress`,
  );
  revalidatePath(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress/${idAvance}/reassign`,
  );

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress?toast=work-order-progress-reassigned`,
  );
}

