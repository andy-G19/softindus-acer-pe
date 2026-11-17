import "server-only";

import { getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { lockWorkOrderRow } from "@/lib/row-locks";
import { WorkOrderRejectedError } from "@/modules/production/work-orders/work-order-rejected-error";

/**
 * Generar los avances de una orden de trabajo: uno pendiente por cada etapa activa de su ruta.
 *
 * Caso de uso y no server action (C1 de la 11.6c, D78), como los de las ordenes (entrega 6): vive
 * fuera de actions.ts porque alli toda funcion async exportada es un endpoint invocable por POST.
 * La accion autoriza, lee el formulario y revalida; este modulo recibe el usuario ya verificado,
 * abre la transaccion y aplica las reglas dentro de ella. Desde C3 de la 11.6c (D80) cada rechazo
 * lanza WorkOrderRejectedError sin campo, con el mismo mensaje: la accion lo muestra en la
 * confirmacion del boton.
 */
export type GenerateWorkOrderProgressParams = {
  idOrdenTrabajo: string;
  idUsuario: string;
};

export async function generateWorkOrderProgress({
  idOrdenTrabajo,
  idUsuario,
}: GenerateWorkOrderProgressParams) {
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
      throw new WorkOrderRejectedError(null, "La orden de trabajo no existe.");
    }

    if (workOrder.estado === "anulada" || workOrder.estado === "finalizada") {
      throw new WorkOrderRejectedError(
        null,
        "No se pueden generar avances para una orden anulada o finalizada.",
      );
    }

    if (!workOrder.ruta_fabricacion) {
      throw new WorkOrderRejectedError(null, "La orden no tiene una ruta de fabricación asociada.");
    }

    if (workOrder.ruta_fabricacion.etapa_ruta.length === 0) {
      throw new WorkOrderRejectedError(null, "La ruta asociada no tiene etapas activas.");
    }

    if (workOrder.avance_orden.length > 0) {
      throw new WorkOrderRejectedError(null, "Esta orden ya tiene avances generados.");
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
        id_usuario_actualiza: idUsuario,
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
}
