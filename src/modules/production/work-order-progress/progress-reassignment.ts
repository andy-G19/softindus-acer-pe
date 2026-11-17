import "server-only";

import { registerAuditLog } from "@/lib/audit";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { lockWorkOrderRow } from "@/lib/row-locks";
import { WorkOrderRejectedError } from "@/modules/production/work-orders/work-order-rejected-error";
import type { ReassignWorkOrderProgressInput } from "@/schemas/production/work-order-progress.schema";

/**
 * Reasignar el operario de un avance de una orden de trabajo.
 *
 * Caso de uso y no server action (C1 de la 11.6c, D78): la accion autoriza, valida y revalida;
 * este modulo recibe los datos ya validados y el usuario verificado, abre la transaccion y aplica
 * las reglas dentro de ella. Desde C5 (D82) cada rechazo lanza WorkOrderRejectedError con el mismo
 * mensaje: los del operario, en su campo; los de la orden y el avance, como mensaje general.
 */
export type ReassignWorkOrderProgressParams = {
  data: ReassignWorkOrderProgressInput;
  idUsuario: string;
};

/** Devuelve la orden y el avance, para revalidar sus paginas. */
export async function reassignWorkOrderProgress({
  data,
  idUsuario,
}: ReassignWorkOrderProgressParams): Promise<{ idOrdenTrabajo: string; idAvance: string }> {
  // H8: la reasignacion decide con la orden bloqueada. Un doble envio registraba dos
  // reasignaciones, y se podia reasignar en una orden que se estaba anulando.
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
      throw new WorkOrderRejectedError(null, "El avance seleccionado no existe.");
    }

    if (
      advance.orden_trabajo.estado === "anulada" ||
      advance.orden_trabajo.estado === "finalizada"
    ) {
      throw new WorkOrderRejectedError(
        null,
        "No se puede reasignar el avance de una orden anulada o finalizada.",
      );
    }

    if (!newOperator) {
      throw new WorkOrderRejectedError("id_operario_nuevo", "El nuevo operario no existe o esta inactivo.");
    }

    if (advance.id_operario === newOperator.id_operario) {
      throw new WorkOrderRejectedError(
        "id_operario_nuevo",
        "El nuevo operario debe ser distinto al operario actual.",
      );
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
        id_usuario_responsable: idUsuario,
      },
    });

    await tx.avance_orden.update({
      where: {
        id_avance: advance.id_avance,
      },
      data: {
        id_operario: newOperator.id_operario,
        id_usuario_actualiza: idUsuario,
      },
    });

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "reasignacion_tarea",
      id_registro_afectado: idReasignacion,
      accion: "crear",
      detalle: `Avance ${advance.id_avance} reasignado a ${newOperator.apellidos}, ${newOperator.nombres}.`,
      tx,
    });

    return { idOrdenTrabajo: advance.id_orden_trabajo, idAvance: advance.id_avance };
  });
}
