"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { calculatePendingDelivery } from "@/lib/material-reconciliation";
import { toNumber } from "@/lib/numbers";
import { createWorkOrder } from "@/modules/production/work-orders/create-work-order";
import {
  closeWorkOrderMaterials,
  reopenWorkOrderMaterials,
} from "@/modules/production/work-orders/material-closure";
import {
  deliverMaterials,
  returnMaterial,
} from "@/modules/production/work-orders/material-delivery";
import {
  annulWorkOrder,
  finishWorkOrder,
} from "@/modules/production/work-orders/work-order-status";
import {
  additionalDeliverySchema,
  closeMaterialsSchema,
  materialReturnSchema,
  reopenMaterialsSchema,
} from "@/schemas/production/work-order-materials.schema";
import { workOrderSchema } from "@/schemas/production/work-order.schema";

export async function createWorkOrderAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = workOrderSchema.safeParse({
    tipo_produccion: formData.get("tipo_produccion"),
    id_detalle_pedido: formData.get("id_detalle_pedido") ?? "",
    id_campania: formData.get("id_campania") ?? "",
    id_producto: formData.get("id_producto"),
    id_ruta: formData.get("id_ruta"),
    id_version_receta: formData.get("id_version_receta"),
    cantidad: formData.get("cantidad"),
    fecha_inicio: formData.get("fecha_inicio"),
    fecha_entrega_estimada: formData.get("fecha_entrega_estimada") ?? "",
    prioridad: formData.get("prioridad"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const idOrdenTrabajo = await createWorkOrder({
    data,
    idUsuario: session.user.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");

  redirect(`/dashboard/production/work-orders/${idOrdenTrabajo}?toast=work-order-created`);
}

/**
 * Entrega al taller todo lo que falta del requerimiento congelado.
 *
 * Lee del snapshot y no de la receta: la orden ya fijo su plan al crearse, y una edicion
 * posterior de la receta no debe cambiar lo que se entrega.
 */
export async function deliverWorkOrderMaterialsAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "").trim();

  if (!idOrdenTrabajo) {
    throw new Error("No se recibio la orden de trabajo.");
  }

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
      idUsuario: session.user.id,
      lines,
      motivo: `Salida por entrega de materiales a la orden ${idOrdenTrabajo}`,
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "entregar_materiales",
      detalle: `Materiales entregados a la orden ${idOrdenTrabajo}: ${lines.length} material(es).`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}?toast=work-order-materials-delivered`,
  );
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
export async function deliverAdditionalMaterialAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = additionalDeliverySchema.safeParse({
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    id_requerimiento: formData.get("id_requerimiento"),
    cantidad: formData.get("cantidad"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

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
      idUsuario: session.user.id,
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
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "entrega_adicional",
      detalle: `Entrega adicional de ${data.cantidad.toFixed(2)} ${requirement.unidad_medida} de ${requirement.material.nombre_material}. Motivo: ${data.motivo}`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  redirect(
    `/dashboard/production/work-orders/${data.id_orden_trabajo}?toast=work-order-additional-delivery`,
  );
}

/**
 * Devuelve al almacen material entregado y no usado.
 *
 * No se puede devolver mas de lo entregado. Como el consumo todavia no se declaro cuando
 * se devuelve, la unica cota posible en este momento es lo entregado menos lo ya devuelto.
 */
export async function returnWorkOrderMaterialAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = materialReturnSchema.safeParse({
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    id_requerimiento: formData.get("id_requerimiento"),
    cantidad: formData.get("cantidad"),
    motivo: formData.get("motivo") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

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
      idUsuario: session.user.id,
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
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "devolver_material",
      detalle: `Devolucion de ${data.cantidad.toFixed(2)} ${requirement.unidad_medida} de ${requirement.material.nombre_material}.${data.motivo ? ` Motivo: ${data.motivo}` : ""}`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  redirect(
    `/dashboard/production/work-orders/${data.id_orden_trabajo}?toast=work-order-material-returned`,
  );
}

export async function closeWorkOrderMaterialsAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "").trim();
  const requirementIds = formData.getAll("id_requerimiento").map(String);
  const consumedValues = formData.getAll("cantidad_consumida").map(String);

  const parsed = closeMaterialsSchema.safeParse({
    id_orden_trabajo: idOrdenTrabajo,
    cantidad_producida: formData.get("cantidad_producida"),
    lineas: requirementIds.map((id, index) => ({
      id_requerimiento: id,
      cantidad_consumida: consumedValues[index] ?? "0",
    })),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  await closeWorkOrderMaterials({ data, idUsuario: session.user.id });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  redirect(
    `/dashboard/production/work-orders/${data.id_orden_trabajo}?toast=work-order-materials-closed`,
  );
}

// Solo ADMIN: reabrir habilita reescribir la merma declarada (ver material-closure.ts).
export async function reopenWorkOrderMaterialsAction(formData: FormData) {
  const session = await requireRole(["ADMIN"]);

  const parsed = reopenMaterialsSchema.safeParse({
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  await reopenWorkOrderMaterials({ data, idUsuario: session.user.id });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  redirect(
    `/dashboard/production/work-orders/${data.id_orden_trabajo}?toast=work-order-materials-reopened`,
  );
}

export async function annulWorkOrderAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "");

  if (!idOrdenTrabajo) {
    throw new Error("No se recibio la orden de trabajo.");
  }

  await annulWorkOrder({ idOrdenTrabajo, idUsuario: session.user.id });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);

  redirect("/dashboard/production/work-orders?toast=work-order-annulled");
}

export async function finishWorkOrderAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "");

  if (!idOrdenTrabajo) {
    throw new Error("No se recibio la orden de trabajo.");
  }

  const result = await finishWorkOrder({
    idOrdenTrabajo,
    idUsuario: session.user.id,
  });

  if (result === "ya_finalizada") {
    redirect(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);

  redirect(`/dashboard/production/work-orders/${idOrdenTrabajo}?toast=work-order-finished`);
}
