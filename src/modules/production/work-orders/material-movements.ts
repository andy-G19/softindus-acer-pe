import "server-only";

import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { calculatePendingDelivery } from "@/lib/material-reconciliation";
import { toNumber } from "@/lib/numbers";
import {
  deliverMaterials,
  returnMaterial,
} from "@/modules/production/work-orders/material-delivery";
import type {
  AdditionalDeliveryInput,
  MaterialReturnInput,
} from "@/schemas/production/work-order-materials.schema";

/**
 * Movimientos de material entre el almacen y una orden de trabajo: la entrega de lo
 * pendiente, la entrega adicional y la devolucion.
 *
 * Casos de uso, no server actions (ver work-order-status.ts): reciben los datos ya
 * validados y el usuario ya verificado, comprueban el estado de la orden, el material y
 * el stock, y abren la transaccion. El descuento y el incremento atomicos del stock, el
 * kardex y las alertas viven en material-delivery.ts, que estos casos de uso llaman
 * dentro de su transaccion.
 */
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
 */
export async function deliverPendingMaterials({
  idOrdenTrabajo,
  idUsuario,
}: DeliverPendingMaterialsParams) {
  const workOrder = await prisma.orden_trabajo.findUnique({
    where: { id_orden_trabajo: idOrdenTrabajo },
    include: {
      requerimiento_orden_material: {
        include: { material: true },
        orderBy: { id_requerimiento: "asc" },
      },
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (workOrder.estado === "anulada" || workOrder.estado === "finalizada") {
    throw new Error(
      "No se puede entregar material a una orden anulada o finalizada.",
    );
  }

  if (workOrder.fecha_cierre_materiales) {
    throw new Error(
      "Los materiales de esta orden ya fueron cerrados: no se puede mover mas material.",
    );
  }

  if (workOrder.requerimiento_orden_material.length === 0) {
    throw new Error(
      "Esta orden no tiene requerimiento congelado: se creo antes de que el sistema lo registrara. No es posible entregar material contra ella.",
    );
  }

  const lines = workOrder.requerimiento_orden_material
    .map((requirement) => {
      const pending = calculatePendingDelivery({
        required: requirement.cantidad_requerida,
        delivered: requirement.cantidad_entregada,
      });

      return {
        idRequerimiento: requirement.id_requerimiento,
        idMaterial: requirement.id_material,
        materialName: requirement.material.nombre_material,
        materialIsActive: requirement.material.estado,
        quantity: pending,
        stockActual: toNumber(requirement.material.stock_actual),
        stockMinimo: toNumber(requirement.material.stock_minimo),
      };
    })
    .filter((line) => line.quantity > 0);

  if (lines.length === 0) {
    throw new Error(
      "No queda nada pendiente por entregar en esta orden. Usa la entrega adicional si produccion necesita mas material.",
    );
  }

  const inactiveMaterials = lines.filter((line) => !line.materialIsActive);

  if (inactiveMaterials.length > 0) {
    throw new Error(
      `No se puede entregar materiales inactivos: ${inactiveMaterials
        .map((line) => line.materialName)
        .join(", ")}.`,
    );
  }

  const insufficient = lines.filter((line) => line.stockActual < line.quantity);

  if (insufficient.length > 0) {
    const detail = insufficient
      .map(
        (line) =>
          `${line.materialName} requiere ${line.quantity.toFixed(2)} y tiene ${line.stockActual.toFixed(2)}`,
      )
      .join("; ");

    throw new Error(`Stock insuficiente para entregar la orden: ${detail}.`);
  }

  await prisma.$transaction(async (tx) => {
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
}: DeliverAdditionalMaterialParams) {
  const requirement = await prisma.requerimiento_orden_material.findUnique({
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
    throw new Error("El material solicitado no pertenece a esta orden.");
  }

  if (requirement.orden_trabajo.id_orden_trabajo !== data.id_orden_trabajo) {
    throw new Error("El material solicitado no pertenece a esta orden.");
  }

  if (
    requirement.orden_trabajo.estado === "anulada" ||
    requirement.orden_trabajo.estado === "finalizada"
  ) {
    throw new Error(
      "No se puede entregar material a una orden anulada o finalizada.",
    );
  }

  if (requirement.orden_trabajo.fecha_cierre_materiales) {
    throw new Error("Los materiales de esta orden ya fueron cerrados.");
  }

  if (!requirement.material.estado) {
    throw new Error(
      `No se puede entregar ${requirement.material.nombre_material}: el material esta inactivo.`,
    );
  }

  const stockActual = toNumber(requirement.material.stock_actual);

  if (stockActual < data.cantidad) {
    throw new Error(
      `Stock insuficiente para ${requirement.material.nombre_material}: se piden ${data.cantidad.toFixed(2)} y hay ${stockActual.toFixed(2)}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await deliverMaterials(tx, {
      idOrdenTrabajo: data.id_orden_trabajo,
      idUsuario,
      lines: [
        {
          idRequerimiento: requirement.id_requerimiento,
          idMaterial: requirement.id_material,
          materialName: requirement.material.nombre_material,
          quantity: data.cantidad,
          stockActual,
          stockMinimo: toNumber(requirement.material.stock_minimo),
        },
      ],
      motivo: `Entrega adicional a la orden ${data.id_orden_trabajo}: ${data.motivo}`,
    });

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "entrega_adicional",
      detalle: `Entrega adicional de ${data.cantidad.toFixed(2)} ${requirement.unidad_medida} de ${requirement.material.nombre_material}. Motivo: ${data.motivo}`,
      tx,
    });
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
}: ReturnMaterialToWarehouseParams) {
  const requirement = await prisma.requerimiento_orden_material.findUnique({
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
    throw new Error("El material indicado no pertenece a esta orden.");
  }

  if (requirement.orden_trabajo.estado === "anulada") {
    throw new Error("No se puede devolver material de una orden anulada.");
  }

  if (requirement.orden_trabajo.fecha_cierre_materiales) {
    throw new Error(
      "Los materiales de esta orden ya fueron cerrados: no se puede mover mas material.",
    );
  }

  const entregado = toNumber(requirement.cantidad_entregada);
  const devuelto = toNumber(requirement.cantidad_devuelta);
  const devolvible = Number((entregado - devuelto).toFixed(2));

  if (devolvible <= 0) {
    throw new Error(
      `No queda material de ${requirement.material.nombre_material} por devolver: se entregaron ${entregado.toFixed(2)} y ya se devolvieron ${devuelto.toFixed(2)}.`,
    );
  }

  if (data.cantidad > devolvible) {
    throw new Error(
      `No se puede devolver ${data.cantidad.toFixed(2)} de ${requirement.material.nombre_material}: solo quedan ${devolvible.toFixed(2)} sin devolver.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await returnMaterial(tx, {
      idOrdenTrabajo: data.id_orden_trabajo,
      idUsuario,
      idRequerimiento: requirement.id_requerimiento,
      idMaterial: requirement.id_material,
      materialName: requirement.material.nombre_material,
      quantity: data.cantidad,
      stockActual: toNumber(requirement.material.stock_actual),
      stockMinimo: toNumber(requirement.material.stock_minimo),
      motivo: data.motivo
        ? `Devolucion de la orden ${data.id_orden_trabajo}: ${data.motivo}`
        : `Devolucion de material no usado de la orden ${data.id_orden_trabajo}`,
    });

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "devolver_material",
      detalle: `Devolucion de ${data.cantidad.toFixed(2)} ${requirement.unidad_medida} de ${requirement.material.nombre_material}.${data.motivo ? ` Motivo: ${data.motivo}` : ""}`,
      tx,
    });
  });
}
