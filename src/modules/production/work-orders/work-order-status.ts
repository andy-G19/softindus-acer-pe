import "server-only";

import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";

/**
 * Cambios de estado de la orden de trabajo: anular y finalizar.
 *
 * Son casos de uso y no server actions: viven fuera de actions.ts porque alli toda
 * funcion async exportada se convierte en un endpoint invocable por POST. La accion
 * autoriza, lee el formulario, revalida y redirige; el caso de uso recibe el usuario ya
 * verificado, aplica las reglas y abre la transaccion. Lanza los mismos errores
 * que la accion mostraba antes de separarse.
 */
export type WorkOrderStatusParams = {
  idOrdenTrabajo: string;
  idUsuario: string;
};

export async function annulWorkOrder({
  idOrdenTrabajo,
  idUsuario,
}: WorkOrderStatusParams) {
  const workOrder = await prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    select: {
      id_orden_trabajo: true,
      estado: true,
      movimiento_inventario: {
        select: {
          id_movimiento: true,
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (workOrder.estado === "anulada") {
    throw new Error("La orden de trabajo ya esta anulada.");
  }

  if (workOrder.estado === "finalizada") {
    throw new Error("No se puede anular una orden finalizada desde el listado.");
  }

  if (workOrder.movimiento_inventario.length > 0) {
    throw new Error(
      "No se puede anular una orden con consumos registrados sin reversar inventario.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.orden_trabajo.update({
      where: {
        id_orden_trabajo: idOrdenTrabajo,
      },
      data: {
        estado: "anulada",
        fecha_entrega_real: null,
      },
    });

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "anular",
      detalle: `Orden de trabajo anulada: ${idOrdenTrabajo}`,
      tx,
    });
  });
}

/**
 * Finalizar una orden ya finalizada no es un error: la accion vuelve al detalle sin
 * toast. Por eso el resultado distingue ese caso en lugar de lanzar.
 */
export type FinishWorkOrderResult = "finalizada" | "ya_finalizada";

export async function finishWorkOrder({
  idOrdenTrabajo,
  idUsuario,
}: WorkOrderStatusParams): Promise<FinishWorkOrderResult> {
  const workOrder = await prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    include: {
      avance_orden: {
        select: {
          estado_etapa: true,
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (workOrder.estado === "anulada") {
    throw new Error("No se puede finalizar una orden anulada.");
  }

  if (workOrder.estado === "finalizada") {
    return "ya_finalizada";
  }

  if (workOrder.avance_orden.length === 0) {
    throw new Error("La orden no tiene avances generados.");
  }

  const allStagesFinished = workOrder.avance_orden.every(
    (advance) => advance.estado_etapa === "terminada",
  );

  if (!allStagesFinished) {
    throw new Error(
      "Solo se puede finalizar una orden cuando todas sus etapas estan terminadas.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.orden_trabajo.update({
      where: {
        id_orden_trabajo: idOrdenTrabajo,
      },
      data: {
        estado: "finalizada",
        fecha_entrega_real: new Date(),
      },
    });

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "finalizar",
      detalle: `Orden de trabajo finalizada: ${idOrdenTrabajo}`,
      tx,
    });
  });

  return "finalizada";
}
