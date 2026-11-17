"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { generateWorkOrderProgress } from "@/modules/production/work-order-progress/progress-generation";
import { reassignWorkOrderProgress } from "@/modules/production/work-order-progress/progress-reassignment";
import { updateWorkOrderProgress } from "@/modules/production/work-order-progress/progress-update";
import {
  reassignWorkOrderProgressSchema,
  updateWorkOrderProgressSchema,
} from "@/schemas/production/work-order-progress.schema";

// C1 de la 11.6c (D78): cada accion autoriza, lee el formulario, llama a su caso de uso
// (progress-generation.ts, progress-update.ts, progress-reassignment.ts), revalida y redirige.
// Las transacciones y sus reglas viven en los casos de uso, que no son endpoints.

export async function generateWorkOrderProgressAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "");

  if (!idOrdenTrabajo) {
    throw new Error("No se recibió la orden de trabajo.");
  }

  await generateWorkOrderProgress({ idOrdenTrabajo, idUsuario: session.user.id });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}/progress`);

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}/progress?toast=work-order-progress-generated`,
  );
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
