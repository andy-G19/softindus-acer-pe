"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
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

export async function updateWorkOrderProgressAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = updateWorkOrderProgressSchema.safeParse({
    id_avance: formData.get("id_avance"),
    estado_etapa: formData.get("estado_etapa"),
    porcentaje_avance: formData.get("porcentaje_avance"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const idOrdenTrabajo = await updateWorkOrderProgress({
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

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress?toast=work-order-progress-updated`,
  );
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
