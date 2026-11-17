"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import type { FieldErrors } from "@/lib/errors";
import { IdempotencyConflictError } from "@/lib/idempotency";
import { APP_ROLES } from "@/lib/permissions";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
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
import { WorkOrderRejectedError } from "@/modules/production/work-orders/work-order-rejected-error";
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
      return fail(error.message, error.fieldErrors);
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

// C3 de la 11.6b (D75): entregar lo pendiente responde a ConfirmActionButton con un RowStatusState
// en lugar de redirigir. Antes cualquier rechazo (stock insuficiente, material inactivo, nada
// pendiente) lanzaba un error que se veia en la pagina de error; ahora queda en la confirmacion. Sin
// permiso responde con un error. Sin clave: lo pendiente, calculado con la orden bloqueada, ya hace
// que un segundo envio no entregue nada.
export async function deliverWorkOrderMaterialsAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "").trim();
  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return rowStatusError(idOrdenTrabajo, "No tienes permisos para entregar materiales a órdenes de trabajo.");
  }

  if (!idOrdenTrabajo) {
    return rowStatusError(idOrdenTrabajo, "No se recibio la orden de trabajo.");
  }

  try {
    await deliverPendingMaterials({ idOrdenTrabajo, idUsuario: session.user.id });
  } catch (error) {
    if (error instanceof WorkOrderRejectedError) {
      return rowStatusError(idOrdenTrabajo, error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);

  return rowStatusDone(idOrdenTrabajo, "entregado");
}

/** Lo que el formulario de entrega adicional o devolucion envio, para volver a mostrarlo. */
export type MaterialMovementFormValues = {
  id_requerimiento: string;
  cantidad: string;
  motivo: string;
};

type MaterialMovementResult = {
  id_orden_trabajo: string;
  /** El movimiento del kardex que registro la operacion. */
  id_movimiento: string;
  clave_operacion: string;
};

// C1 de la 11.6b (D73): la entrega adicional y la devolucion no redirigen; devuelven el resultado
// y el detalle se repinta con la revalidacion. Antes cualquier rechazo lanzaba un error que se
// veia en la pagina de error y se perdia lo escrito; ahora queda en el formulario, junto al campo
// que lo causa y con lo enviado. Sin permiso responden con un error. El exito lleva la clave
// confirmada para que el formulario genere otra (OperationKeyField).
export type AdditionalDeliveryFormState = FormActionState<MaterialMovementFormValues, MaterialMovementResult>;
export type MaterialReturnFormState = FormActionState<MaterialMovementFormValues, MaterialMovementResult>;

type MaterialMovementFormState = AdditionalDeliveryFormState | MaterialReturnFormState;

type MaterialMovementOperation<Input> = {
  schema: {
    safeParse: (
      value: unknown,
    ) =>
      | { success: true; data: Input & { id_orden_trabajo: string; clave_operacion: string } }
      | { success: false; error: { flatten: () => { fieldErrors: FieldErrors } } };
  };
  run: (params: { data: Input; idUsuario: string }) => Promise<string>;
};

/** El cuerpo comun de las dos acciones: permiso, esquema, caso de uso, revalidacion y resultado. */
async function runMaterialMovement<Input>(
  formData: FormData,
  { schema, run }: MaterialMovementOperation<Input>,
): Promise<MaterialMovementFormState> {
  const values: MaterialMovementFormValues = {
    id_requerimiento: formData.get("id_requerimiento")?.toString() ?? "",
    cantidad: formData.get("cantidad")?.toString() ?? "",
    motivo: formData.get("motivo")?.toString() ?? "",
  };
  const fail = (error: string, fieldErrors?: FieldErrors): MaterialMovementFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return fail("No tienes permisos para mover material de órdenes de trabajo.");
  }

  const parsed = schema.safeParse({
    ...values,
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    clave_operacion: formData.get("clave_operacion"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La clave y la orden van en campos ocultos: su mensaje es el general, no el de un campo.
    const hiddenError = fieldErrors.clave_operacion?.[0] ?? fieldErrors.id_orden_trabajo?.[0];

    return fail(hiddenError ?? "Revisa los datos del movimiento de material.", fieldErrors);
  }

  const data = parsed.data;
  let idMovimiento: string;

  try {
    idMovimiento = await run({ data, idUsuario: session.user.id });
  } catch (error) {
    if (error instanceof WorkOrderRejectedError) {
      return fail(error.message, error.fieldErrors);
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  return {
    status: "success",
    data: {
      id_orden_trabajo: data.id_orden_trabajo,
      id_movimiento: idMovimiento,
      clave_operacion: data.clave_operacion,
    },
    values,
    operationId: newOperationId(),
  };
}

export async function deliverAdditionalMaterialAction(
  _prevState: AdditionalDeliveryFormState,
  formData: FormData,
): Promise<AdditionalDeliveryFormState> {
  return runMaterialMovement(formData, {
    schema: additionalDeliverySchema,
    run: deliverAdditionalMaterial,
  });
}

export async function returnWorkOrderMaterialAction(
  _prevState: MaterialReturnFormState,
  formData: FormData,
): Promise<MaterialReturnFormState> {
  return runMaterialMovement(formData, {
    schema: materialReturnSchema,
    run: returnMaterialToWarehouse,
  });
}

/** Lo que el formulario de cierre envio, tal cual, para volver a mostrarlo. */
export type CloseMaterialsFormValues = {
  cantidad_producida: string;
  lineas: { id_requerimiento: string; cantidad_consumida: string }[];
};

/** Lo que el formulario de reapertura envio, para volver a mostrarlo. */
export type ReopenMaterialsFormValues = { motivo: string };

// C2 de la 11.6b (D74): cerrar y reabrir no redirigen; devuelven el resultado y el detalle se
// repinta con la revalidacion. Antes cualquier rechazo lanzaba un error que se veia en la pagina de
// error y se perdia lo declarado; ahora queda en el formulario, en el campo que lo causa (el consumo
// de una linea, en lineas.<posicion>.cantidad_consumida) y con lo enviado. Sin permiso responden
// con un error. Sin clave: la fecha de cierre, leida con la orden bloqueada, ya hace que un segundo
// cierre o una segunda reapertura no escriba.
export type CloseMaterialsFormState = FormActionState<CloseMaterialsFormValues, { id_orden_trabajo: string }>;
export type ReopenMaterialsFormState = FormActionState<ReopenMaterialsFormValues, { id_orden_trabajo: string }>;

const workOrderClosurePaths = (idOrdenTrabajo: string) => [
  "/dashboard",
  "/dashboard/production/work-orders",
  `/dashboard/production/work-orders/${idOrdenTrabajo}`,
];

/**
 * Los errores del esquema por campo. Las claves salen de la ruta de cada problema porque flatten de
 * Zod no conserva las rutas anidadas (lineas.1.cantidad_consumida).
 */
function closeFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of issues) {
    const key = issue.path.map(String).join(".");

    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }

  return fieldErrors;
}

export async function closeWorkOrderMaterialsAction(
  _prevState: CloseMaterialsFormState,
  formData: FormData,
): Promise<CloseMaterialsFormState> {
  const consumedValues = formData.getAll("cantidad_consumida").map(String);
  const values: CloseMaterialsFormValues = {
    cantidad_producida: formData.get("cantidad_producida")?.toString() ?? "",
    lineas: formData.getAll("id_requerimiento").map((id, index) => ({
      id_requerimiento: String(id),
      cantidad_consumida: consumedValues[index] ?? "",
    })),
  };
  const fail = (error: string, fieldErrors?: FieldErrors): CloseMaterialsFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return fail("No tienes permisos para cerrar materiales de órdenes de trabajo.");
  }

  const parsed = closeMaterialsSchema.safeParse({
    id_orden_trabajo: String(formData.get("id_orden_trabajo") ?? "").trim(),
    cantidad_producida: formData.get("cantidad_producida"),
    lineas: values.lineas.map((linea) => ({
      id_requerimiento: linea.id_requerimiento,
      // Una linea sin valor se declaraba en cero, como antes.
      cantidad_consumida: linea.cantidad_consumida || "0",
    })),
  });

  if (!parsed.success) {
    const fieldErrors = closeFieldErrors(parsed.error.issues);
    // La orden, los materiales y su lista van en campos ocultos: su mensaje es el general.
    const hiddenError = parsed.error.issues.find(
      (issue) => issue.path[0] === "id_orden_trabajo" || issue.path.at(-1) === "id_requerimiento" || issue.path.join(".") === "lineas",
    )?.message;

    return fail(hiddenError ?? "Revisa el cierre de materiales.", fieldErrors);
  }

  const data = parsed.data;

  try {
    await closeWorkOrderMaterials({ data, idUsuario: session.user.id });
  } catch (error) {
    if (error instanceof WorkOrderRejectedError) {
      return fail(error.message, error.fieldErrors);
    }

    throw error;
  }

  for (const path of workOrderClosurePaths(data.id_orden_trabajo)) {
    revalidatePath(path);
  }

  return {
    status: "success",
    data: { id_orden_trabajo: data.id_orden_trabajo },
    values,
    operationId: newOperationId(),
  };
}

// Solo ADMIN: reabrir habilita reescribir la merma declarada (ver material-closure.ts).
export async function reopenWorkOrderMaterialsAction(
  _prevState: ReopenMaterialsFormState,
  formData: FormData,
): Promise<ReopenMaterialsFormState> {
  const values: ReopenMaterialsFormValues = { motivo: formData.get("motivo")?.toString() ?? "" };
  const fail = (error: string, fieldErrors?: FieldErrors): ReopenMaterialsFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail("No tienes permisos para reabrir el cierre de materiales.");
  }

  const parsed = reopenMaterialsSchema.safeParse({
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La orden va en un campo oculto: su mensaje es el general, no el de un campo.
    const hiddenError = fieldErrors.id_orden_trabajo?.[0];

    return fail(hiddenError ?? "Revisa el motivo de la reapertura.", fieldErrors);
  }

  const data = parsed.data;

  try {
    await reopenWorkOrderMaterials({ data, idUsuario: session.user.id });
  } catch (error) {
    if (error instanceof WorkOrderRejectedError) {
      return fail(error.message, error.fieldErrors);
    }

    throw error;
  }

  for (const path of workOrderClosurePaths(data.id_orden_trabajo)) {
    revalidatePath(path);
  }

  return {
    status: "success",
    data: { id_orden_trabajo: data.id_orden_trabajo },
    values,
    operationId: newOperationId(),
  };
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
