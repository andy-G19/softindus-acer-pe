"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import type { FieldErrors } from "@/lib/errors";
import { IdempotencyConflictError } from "@/lib/idempotency";
import { APP_ROLES } from "@/lib/permissions";
import {
  createWorkOrder,
  WorkOrderRejectedError,
} from "@/modules/production/work-orders/create-work-order";
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

/** Lo que el formulario de la orden envio, tal cual, para volver a mostrarlo. */
export type WorkOrderFormValues = {
  tipo_produccion: string;
  id_detalle_pedido: string;
  id_campania: string;
  id_producto: string;
  id_ruta: string;
  id_version_receta: string;
  cantidad: string;
  fecha_inicio: string;
  fecha_entrega_estimada: string;
  prioridad: string;
  observaciones: string;
};

// C5 de la 11.6a (D66): crear no redirige; devuelve el resultado y el formulario da el aviso y va
// al detalle de la orden creada. Antes cualquier rechazo lanzaba un error que se veia en la pagina
// de error y el formulario se perdia; ahora queda en el formulario, junto al campo que lo causa y
// con lo enviado. Sin permiso responde con un error. El exito lleva la clave confirmada para que
// el formulario genere otra (OperationKeyField).
export type WorkOrderFormState = FormActionState<
  WorkOrderFormValues,
  { id_orden_trabajo: string; clave_operacion: string }
>;

function getWorkOrderFormValues(formData: FormData): WorkOrderFormValues {
  const text = (name: keyof WorkOrderFormValues) => formData.get(name)?.toString() ?? "";

  return {
    tipo_produccion: text("tipo_produccion"),
    id_detalle_pedido: text("id_detalle_pedido"),
    id_campania: text("id_campania"),
    id_producto: text("id_producto"),
    id_ruta: text("id_ruta"),
    id_version_receta: text("id_version_receta"),
    cantidad: text("cantidad"),
    fecha_inicio: text("fecha_inicio"),
    fecha_entrega_estimada: text("fecha_entrega_estimada"),
    prioridad: text("prioridad"),
    observaciones: text("observaciones"),
  };
}

export async function createWorkOrderAction(
  _prevState: WorkOrderFormState,
  formData: FormData,
): Promise<WorkOrderFormState> {
  const values = getWorkOrderFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): WorkOrderFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return fail("No tienes permisos para crear órdenes de trabajo.");
  }

  const parsed = workOrderSchema.safeParse({
    ...values,
    clave_operacion: formData.get("clave_operacion"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La clave va en un campo oculto: su mensaje es el general, no el de un campo.
    const keyError = fieldErrors.clave_operacion?.[0];

    return fail(keyError ?? "Revisa los datos de la orden de trabajo.", fieldErrors);
  }

  let idOrdenTrabajo: string;

  try {
    idOrdenTrabajo = await createWorkOrder({
      data: parsed.data,
      idUsuario: session.user.id,
    });
  } catch (error) {
    if (error instanceof WorkOrderRejectedError) {
      return fail(error.message, { [error.field]: [error.message] });
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");

  return {
    status: "success",
    data: { id_orden_trabajo: idOrdenTrabajo, clave_operacion: parsed.data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
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
