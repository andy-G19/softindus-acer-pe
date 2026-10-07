"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { createWorkOrder } from "@/modules/production/work-orders/create-work-order";
import {
  closeWorkOrderMaterials,
  reopenWorkOrderMaterials,
} from "@/modules/production/work-orders/material-closure";
import {
  deliverAdditionalMaterial,
  deliverPendingMaterials,
  returnMaterialToWarehouse,
} from "@/modules/production/work-orders/material-movements";
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

export async function deliverWorkOrderMaterialsAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "").trim();

  if (!idOrdenTrabajo) {
    throw new Error("No se recibio la orden de trabajo.");
  }

  await deliverPendingMaterials({ idOrdenTrabajo, idUsuario: session.user.id });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}?toast=work-order-materials-delivered`,
  );
}

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

  await deliverAdditionalMaterial({ data, idUsuario: session.user.id });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  redirect(
    `/dashboard/production/work-orders/${data.id_orden_trabajo}?toast=work-order-additional-delivery`,
  );
}

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

  await returnMaterialToWarehouse({ data, idUsuario: session.user.id });

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
