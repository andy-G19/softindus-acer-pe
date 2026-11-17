import "server-only";

import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/decimal-cents";
import { claimOperation, completeOperation } from "@/lib/idempotency";
import { pendingDeliveryQuantity, quantityHundredths, roundMaterialQuantity } from "@/lib/material-quantities";
import { lockWorkOrderRow } from "@/lib/row-locks";
import {
  deliverMaterials,
  returnMaterial,
} from "@/modules/production/work-orders/material-delivery";
import { WorkOrderRejectedError } from "@/modules/production/work-orders/work-order-rejected-error";
import type {
  AdditionalDeliveryInput,
  MaterialReturnInput,
} from "@/schemas/production/work-order-materials.schema";

/**
 * Movimientos de material entre el almacen y una orden de trabajo: la entrega de lo
 * pendiente, la entrega adicional y la devolucion.
 *
 * Casos de uso, no server actions (ver work-order-status.ts): reciben los datos ya
 * validados y el usuario ya verificado, abren la transaccion y dentro comprueban el
 * estado de la orden, el material y el stock. El descuento y el incremento atomicos del
 * stock, el kardex y las alertas viven en material-delivery.ts, que estos casos de uso
 * llaman dentro de su transaccion.
 *
 * Cada caso de uso bloquea la orden antes de leer (H1). Un doble envio de una devolucion
 * ya no devuelve dos veces (el segundo ve lo ya devuelto), un doble envio de la entrega
 * pendiente ya no entrega dos veces, y una anulacion, que bloquea la misma orden, ya no
 * puede colarse entre la validacion y la salida de material.
 *
 * El bloqueo es de la orden, no del material: otra orden, una compra o una salida pueden
 * mover el mismo material a la vez. Por eso el stock que leen estos casos de uso solo
 * sirve para validar y explicar un rechazo; el que anotan el kardex y la alerta lo
 * devuelve la escritura en material-delivery.ts (H2).
 *
 * C1 de la 11.6b (D73): el candado pone en fila dos envios iguales, pero el segundo volvia a
 * validar y movia el stock otra vez: una entrega adicional salia dos veces y una devolucion
 * parcial volvia dos veces (el segundo envio solo «ve lo ya devuelto» cuando se devuelve todo).
 * Por eso la entrega adicional y la devolucion reclaman la clave de operacion como primera
 * sentencia de la transaccion, antes del candado, y la completan con su movimiento del kardex. Un
 * reenvio con la misma clave responde con ese movimiento sin leer ni escribir. Cada rechazo lanza
 * WorkOrderRejectedError con su campo, la transaccion se revierte y la clave queda libre.
 */
const ADDITIONAL_OPERATION = "entrega_adicional_material";
const RETURN_OPERATION = "devolver_material";

export type DeliverPendingMaterialsParams = {
  idOrdenTrabajo: string;
  idUsuario: string;
};

export type DeliverAdditionalMaterialParams = {
  data: AdditionalDeliveryInput;
  idUsuario: string;
};

export type ReturnMaterialToWarehouseParams = {
  data: MaterialReturnInput;
  idUsuario: string;
};

/**
 * Entrega al taller todo lo que falta del requerimiento congelado.
 *
 * Lee del snapshot y no de la receta: la orden ya fijo su plan al crearse, y una edicion
 * posterior de la receta no debe cambiar lo que se entrega.
 *
 * Sin clave de operacion (C3 de la 11.6b, D75): lo pendiente se calcula con la orden bloqueada,
 * asi que un segundo envio ve que no queda nada y no entrega. Cada rechazo lanza
 * WorkOrderRejectedError sin campo: la accion lo muestra en la confirmacion.
 */
export async function deliverPendingMaterials({
  idOrdenTrabajo,
  idUsuario,
}: DeliverPendingMaterialsParams) {
  await prisma.$transaction(async (tx) => {
    await lockWorkOrderRow(tx, idOrdenTrabajo);

    const workOrder = await tx.orden_trabajo.findUnique({
      where: { id_orden_trabajo: idOrdenTrabajo },
      include: {
        requerimiento_orden_material: {
          include: { material: true },
          orderBy: { id_requerimiento: "asc" },
        },
      },
    });

    if (!workOrder) {
      throw new WorkOrderRejectedError(null, "La orden de trabajo no existe.");
    }

    if (workOrder.estado === "anulada" || workOrder.estado === "finalizada") {
      throw new WorkOrderRejectedError(
        null,
        "No se puede entregar material a una orden anulada o finalizada.",
      );
    }

    if (workOrder.fecha_cierre_materiales) {
      throw new WorkOrderRejectedError(
        null,
        "Los materiales de esta orden ya fueron cerrados: no se puede mover mas material.",
      );
    }

    if (workOrder.requerimiento_orden_material.length === 0) {
      throw new WorkOrderRejectedError(
        null,
        "Esta orden no tiene requerimiento congelado: se creo antes de que el sistema lo registrara. No es posible entregar material contra ella.",
      );
    }

    const lines = workOrder.requerimiento_orden_material
      .map((requirement) => {
        return {
          idRequerimiento: requirement.id_requerimiento,
          idMaterial: requirement.id_material,
          materialName: requirement.material.nombre_material,
          materialIsActive: requirement.material.estado,
          // C1 de la 11.6a (D62): la cantidad y el stock se comparan y se escriben en centesimos.
          // C3 de la 11.6b (D75): la misma funcion con la que la confirmacion dice lo que sale.
          quantity: pendingDeliveryQuantity({
            required: requirement.cantidad_requerida,
            delivered: requirement.cantidad_entregada,
          }),
          stockActual: quantityHundredths(requirement.material.stock_actual),
        };
      })
      .filter((line) => quantityHundredths(line.quantity) > 0n);

    if (lines.length === 0) {
      throw new WorkOrderRejectedError(
        null,
        "No queda nada pendiente por entregar en esta orden. Usa la entrega adicional si produccion necesita mas material.",
      );
    }

    const inactiveMaterials = lines.filter((line) => !line.materialIsActive);

    if (inactiveMaterials.length > 0) {
      throw new WorkOrderRejectedError(
        null,
        `No se puede entregar materiales inactivos: ${inactiveMaterials
          .map((line) => line.materialName)
          .join(", ")}.`,
      );
    }

    const insufficient = lines.filter((line) => line.stockActual < quantityHundredths(line.quantity));

    if (insufficient.length > 0) {
      const detail = insufficient
        .map(
          (line) =>
            `${line.materialName} requiere ${line.quantity} y tiene ${formatCents(line.stockActual)}`,
        )
        .join("; ");

      throw new WorkOrderRejectedError(null, `Stock insuficiente para entregar la orden: ${detail}.`);
    }

    await deliverMaterials(tx, {
      idOrdenTrabajo,
      idUsuario,
      lines,
      motivo: `Salida por entrega de materiales a la orden ${idOrdenTrabajo}`,
    });

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "entregar_materiales",
      detalle: `Materiales entregados a la orden ${idOrdenTrabajo}: ${lines.length} material(es).`,
      tx,
    });
  });
}

/**
 * Entrega extra de un material puntual, por encima de lo planificado.
 *
 * Existe porque en el taller se rompen piezas y hay que rehacerlas. La alternativa seria
 * sacar el material por el modulo de inventario sin vinculo a la orden, y ahi la
 * conciliacion de esa orden quedaria falseada para siempre.
 *
 * El motivo es obligatorio: una salida por encima del plan sin explicacion es exactamente
 * el registro que nadie sabe interpretar tres meses despues.
 */
export async function deliverAdditionalMaterial({
  data,
  idUsuario,
}: DeliverAdditionalMaterialParams): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const claim = await claimOperation(tx, {
      clave: data.clave_operacion,
      tipo: ADDITIONAL_OPERATION,
      userId: idUsuario,
    });

    if (claim.estado === "repetida") {
      if (!claim.idRegistro) {
        throw new Error("La operacion repetida no tiene una entrega registrada.");
      }

      return claim.idRegistro;
    }

    await lockWorkOrderRow(tx, data.id_orden_trabajo);

    const requirement = await tx.requerimiento_orden_material.findUnique({
      where: { id_requerimiento: data.id_requerimiento },
      include: {
        material: true,
        orden_trabajo: {
          select: {
            id_orden_trabajo: true,
            estado: true,
            fecha_cierre_materiales: true,
          },
        },
      },
    });

    if (!requirement) {
      throw new WorkOrderRejectedError("id_requerimiento", "El material solicitado no pertenece a esta orden.");
    }

    if (requirement.orden_trabajo.id_orden_trabajo !== data.id_orden_trabajo) {
      throw new WorkOrderRejectedError("id_requerimiento", "El material solicitado no pertenece a esta orden.");
    }

    if (
      requirement.orden_trabajo.estado === "anulada" ||
      requirement.orden_trabajo.estado === "finalizada"
    ) {
      throw new WorkOrderRejectedError(
        null,
        "No se puede entregar material a una orden anulada o finalizada.",
      );
    }

    if (requirement.orden_trabajo.fecha_cierre_materiales) {
      throw new WorkOrderRejectedError(null, "Los materiales de esta orden ya fueron cerrados.");
    }

    if (!requirement.material.estado) {
      throw new WorkOrderRejectedError(
        "id_requerimiento",
        `No se puede entregar ${requirement.material.nombre_material}: el material esta inactivo.`,
      );
    }

    // C1 de la 11.6a (D62): la cantidad redondeada como sus columnas se compara con el stock en
    // centesimos y es la que se escribe.
    const cantidad = roundMaterialQuantity(data.cantidad);
    const stockActual = quantityHundredths(requirement.material.stock_actual);

    if (stockActual < quantityHundredths(cantidad)) {
      throw new WorkOrderRejectedError(
        "cantidad",
        `Stock insuficiente para ${requirement.material.nombre_material}: se piden ${cantidad} y hay ${formatCents(stockActual)}.`,
      );
    }

    const [idMovimiento] = await deliverMaterials(tx, {
      idOrdenTrabajo: data.id_orden_trabajo,
      idUsuario,
      lines: [
        {
          idRequerimiento: requirement.id_requerimiento,
          idMaterial: requirement.id_material,
          materialName: requirement.material.nombre_material,
          quantity: cantidad,
        },
      ],
      motivo: `Entrega adicional a la orden ${data.id_orden_trabajo}: ${data.motivo}`,
    });

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "entrega_adicional",
      detalle: `Entrega adicional de ${cantidad} ${requirement.unidad_medida} de ${requirement.material.nombre_material}. Motivo: ${data.motivo}`,
      tx,
    });

    await completeOperation(tx, { clave: data.clave_operacion, idRegistro: idMovimiento });

    return idMovimiento;
  });
}

/**
 * Devuelve al almacen material entregado y no usado.
 *
 * No se puede devolver mas de lo entregado. Como el consumo todavia no se declaro cuando
 * se devuelve, la unica cota posible en este momento es lo entregado menos lo ya devuelto.
 */
export async function returnMaterialToWarehouse({
  data,
  idUsuario,
}: ReturnMaterialToWarehouseParams): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const claim = await claimOperation(tx, {
      clave: data.clave_operacion,
      tipo: RETURN_OPERATION,
      userId: idUsuario,
    });

    if (claim.estado === "repetida") {
      if (!claim.idRegistro) {
        throw new Error("La operacion repetida no tiene una devolucion registrada.");
      }

      return claim.idRegistro;
    }

    await lockWorkOrderRow(tx, data.id_orden_trabajo);

    const requirement = await tx.requerimiento_orden_material.findUnique({
      where: { id_requerimiento: data.id_requerimiento },
      include: {
        material: true,
        orden_trabajo: {
          select: {
            id_orden_trabajo: true,
            estado: true,
            fecha_cierre_materiales: true,
          },
        },
      },
    });

    if (!requirement || requirement.orden_trabajo.id_orden_trabajo !== data.id_orden_trabajo) {
      throw new WorkOrderRejectedError("id_requerimiento", "El material indicado no pertenece a esta orden.");
    }

    if (requirement.orden_trabajo.estado === "anulada") {
      throw new WorkOrderRejectedError(null, "No se puede devolver material de una orden anulada.");
    }

    if (requirement.orden_trabajo.fecha_cierre_materiales) {
      throw new WorkOrderRejectedError(
        null,
        "Los materiales de esta orden ya fueron cerrados: no se puede mover mas material.",
      );
    }

    // C1 de la 11.6a (D62): lo devolvible y la cantidad, en centesimos como sus columnas.
    const cantidad = roundMaterialQuantity(data.cantidad);
    const entregado = quantityHundredths(requirement.cantidad_entregada);
    const devuelto = quantityHundredths(requirement.cantidad_devuelta);
    const devolvible = entregado - devuelto;

    if (devolvible <= 0n) {
      throw new WorkOrderRejectedError(
        "id_requerimiento",
        `No queda material de ${requirement.material.nombre_material} por devolver: se entregaron ${formatCents(entregado)} y ya se devolvieron ${formatCents(devuelto)}.`,
      );
    }

    if (quantityHundredths(cantidad) > devolvible) {
      throw new WorkOrderRejectedError(
        "cantidad",
        `No se puede devolver ${cantidad} de ${requirement.material.nombre_material}: solo quedan ${formatCents(devolvible)} sin devolver.`,
      );
    }

    const idMovimiento = await returnMaterial(tx, {
      idOrdenTrabajo: data.id_orden_trabajo,
      idUsuario,
      idRequerimiento: requirement.id_requerimiento,
      idMaterial: requirement.id_material,
      materialName: requirement.material.nombre_material,
      quantity: cantidad,
      motivo: data.motivo
        ? `Devolucion de la orden ${data.id_orden_trabajo}: ${data.motivo}`
        : `Devolucion de material no usado de la orden ${data.id_orden_trabajo}`,
    });

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "devolver_material",
      detalle: `Devolucion de ${cantidad} ${requirement.unidad_medida} de ${requirement.material.nombre_material}.${data.motivo ? ` Motivo: ${data.motivo}` : ""}`,
      tx,
    });

    await completeOperation(tx, { clave: data.clave_operacion, idRegistro: idMovimiento });

    return idMovimiento;
  });
}
