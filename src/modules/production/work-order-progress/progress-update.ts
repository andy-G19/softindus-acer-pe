import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { normalizeProgressPercentage } from "@/lib/progress-percentage";
import { lockWorkOrderRow } from "@/lib/row-locks";
import { WorkOrderRejectedError } from "@/modules/production/work-orders/work-order-rejected-error";
import type { UpdateWorkOrderProgressInput } from "@/schemas/production/work-order-progress.schema";

/**
 * Actualizar una etapa de una orden de trabajo y sincronizar el estado de la orden.
 *
 * Caso de uso y no server action (C1 de la 11.6c, D78): la accion autoriza, valida y revalida;
 * este modulo recibe los datos ya validados y el usuario verificado, abre la transaccion y aplica
 * las reglas dentro de ella. Desde C4 (D81) cada rechazo lanza WorkOrderRejectedError sin campo,
 * con el mismo mensaje: la accion lo muestra en la tarjeta de la etapa. La regla del porcentaje vive en
 * src/lib/progress-percentage.ts (C2 de la 11.6c, D79): la comparte con la pagina de avances.
 */

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

export type UpdateWorkOrderProgressParams = {
  data: UpdateWorkOrderProgressInput;
  idUsuario: string;
};

/** Devuelve la orden del avance, para revalidar sus paginas. */
export async function updateWorkOrderProgress({
  data,
  idUsuario,
}: UpdateWorkOrderProgressParams): Promise<string> {
  // H8: el avance, la sincronizacion del estado de la orden y la bitacora van en una sola
  // transaccion, con la orden bloqueada. Antes eran escrituras sueltas: una actualizacion
  // simultanea con una anulacion devolvia la orden a en proceso, y una falla a mitad
  // dejaba el avance cambiado y la orden sin sincronizar.
  return prisma.$transaction(async (tx) => {
    const located = await tx.avance_orden.findUnique({
      where: {
        id_avance: data.id_avance,
      },
      select: {
        id_orden_trabajo: true,
      },
    });

    if (!located) {
      throw new WorkOrderRejectedError(null, "El avance seleccionado no existe.");
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
      throw new WorkOrderRejectedError(null, "El avance seleccionado no existe.");
    }

    if (
      advance.orden_trabajo.estado === "anulada" ||
      advance.orden_trabajo.estado === "finalizada"
    ) {
      throw new WorkOrderRejectedError(
        null,
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
        id_usuario_actualiza: idUsuario,
      },
    });

    await syncWorkOrderStatus(tx, advance.id_orden_trabajo);

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "avance_orden",
      id_registro_afectado: data.id_avance,
      accion: "actualizar",
      detalle: `Avance actualizado a ${data.estado_etapa} (${normalizedPercentage}%).`,
      tx,
    });

    return advance.id_orden_trabajo;
  });
}
