"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import type { FieldErrors } from "@/lib/errors";
import { APP_ROLES } from "@/lib/permissions";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { generateWorkOrderProgress } from "@/modules/production/work-order-progress/progress-generation";
import { reassignWorkOrderProgress } from "@/modules/production/work-order-progress/progress-reassignment";
import { updateWorkOrderProgress } from "@/modules/production/work-order-progress/progress-update";
import { WorkOrderRejectedError } from "@/modules/production/work-orders/work-order-rejected-error";
import {
  reassignWorkOrderProgressSchema,
  updateWorkOrderProgressSchema,
} from "@/schemas/production/work-order-progress.schema";

// C1 de la 11.6c (D78): cada accion autoriza, lee el formulario, llama a su caso de uso
// (progress-generation.ts, progress-update.ts, progress-reassignment.ts), revalida y responde.
// Las transacciones y sus reglas viven en los casos de uso, que no son endpoints.

// C3 de la 11.6c (D80): generar responde a ConfirmActionButton con un RowStatusState en lugar de
// redirigir. Antes cualquier rechazo (la orden ya tiene avances, esta anulada) lanzaba un error que
// se veia en la pagina de error; ahora queda en la confirmacion. Sin permiso responde con un error.
// Sin clave: con la orden bloqueada, un segundo envio ve los avances del primero y se rechaza. El
// id no se recorta, como antes.
export async function generateWorkOrderProgressAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "");
  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return rowStatusError(idOrdenTrabajo, "No tienes permisos para generar avances de órdenes de trabajo.");
  }

  if (!idOrdenTrabajo) {
    return rowStatusError(idOrdenTrabajo, "No se recibió la orden de trabajo.");
  }

  try {
    await generateWorkOrderProgress({ idOrdenTrabajo, idUsuario: session.user.id });
  } catch (error) {
    if (error instanceof WorkOrderRejectedError) {
      return rowStatusError(idOrdenTrabajo, error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}/progress`);

  return rowStatusDone(idOrdenTrabajo, "generado");
}

/** Lo que el formulario de una etapa envio, tal cual, para volver a mostrarlo. */
export type StageProgressFormValues = {
  estado_etapa: string;
  porcentaje_avance: string;
  observaciones: string;
};

// C4 de la 11.6c (D81): actualizar una etapa no redirige; devuelve el resultado y la pagina se
// repinta con la revalidacion. Antes cualquier rechazo lanzaba un error que se veia en la pagina de
// error y se perdia lo escrito; ahora queda en su campo, o como mensaje general, con lo enviado.
// Sin permiso responde con un error. Sin clave: repetir el envio reescribe los mismos valores.
export type StageProgressFormState = FormActionState<
  StageProgressFormValues,
  { id_avance: string; id_orden_trabajo: string }
>;

export async function updateWorkOrderProgressAction(
  _prevState: StageProgressFormState,
  formData: FormData,
): Promise<StageProgressFormState> {
  const values: StageProgressFormValues = {
    estado_etapa: formData.get("estado_etapa")?.toString() ?? "",
    porcentaje_avance: formData.get("porcentaje_avance")?.toString() ?? "",
    observaciones: formData.get("observaciones")?.toString() ?? "",
  };
  const fail = (error: string, fieldErrors?: FieldErrors): StageProgressFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return fail("No tienes permisos para actualizar avances de órdenes de trabajo.");
  }

  const parsed = updateWorkOrderProgressSchema.safeParse({
    id_avance: formData.get("id_avance"),
    estado_etapa: formData.get("estado_etapa"),
    porcentaje_avance: formData.get("porcentaje_avance"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // El avance va en un campo oculto: su mensaje es el general, no el de un campo.
    const hiddenError = fieldErrors.id_avance?.[0];

    return fail(hiddenError ?? "Revisa los datos de la etapa.", hiddenError ? undefined : fieldErrors);
  }

  let idOrdenTrabajo: string;

  try {
    idOrdenTrabajo = await updateWorkOrderProgress({
      data: parsed.data,
      idUsuario: session.user.id,
    });
  } catch (error) {
    if (error instanceof WorkOrderRejectedError) {
      return fail(error.message, error.fieldErrors);
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
  revalidatePath(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress`,
  );

  return {
    status: "success",
    data: { id_avance: parsed.data.id_avance, id_orden_trabajo: idOrdenTrabajo },
    values,
    operationId: newOperationId(),
  };
}

export async function reassignWorkOrderProgressAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = reassignWorkOrderProgressSchema.safeParse({
    id_avance: formData.get("id_avance"),
    id_operario_nuevo: formData.get("id_operario_nuevo"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const { idOrdenTrabajo, idAvance } = await reassignWorkOrderProgress({
    data: parsed.data,
    idUsuario: session.user.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
  revalidatePath(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress`,
  );
  revalidatePath(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress/${idAvance}/reassign`,
  );

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress?toast=work-order-progress-reassigned`,
  );
}
