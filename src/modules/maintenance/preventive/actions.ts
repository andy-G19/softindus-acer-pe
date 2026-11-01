"use server";

import { revalidatePath } from "next/cache";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockPreventiveMaintenanceRow } from "@/lib/row-locks";
import {
  preventiveMaintenanceSchema,
  preventiveMaintenanceStatusSchema,
} from "@/schemas/maintenance/preventive-maintenance.schema";

/** Lo que el formulario de preventivo envio, tal cual, para volver a mostrarlo. */
export type PreventiveFormValues = {
  id_maquina: string;
  fecha_programada: string;
  estado: string;
  responsable: string;
  actividad: string;
  observaciones: string;
};

// Entrega 10.5b: el alta de preventivos no redirige; devuelve el resultado y el
// formulario da el aviso y cierra el panel o vuelve al listado. Sin permiso
// responde con un error, no redirige. El cambio de estado tampoco: devuelve su
// resultado a RowStatusSelect.
export type PreventiveFormState = FormActionState<PreventiveFormValues, { id_mantenimiento: string }>;

function getPreventiveFormValues(formData: FormData): PreventiveFormValues {
  const text = (name: keyof PreventiveFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_maquina: text("id_maquina"),
    fecha_programada: text("fecha_programada"),
    estado: text("estado"),
    responsable: text("responsable"),
    actividad: text("actividad"),
    observaciones: text("observaciones"),
  };
}

function preventiveError(values: PreventiveFormValues, error: string, fieldErrors?: FieldErrors): PreventiveFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function preventiveSaved(values: PreventiveFormValues, idMantenimiento: string): PreventiveFormState {
  return { status: "success", data: { id_mantenimiento: idMantenimiento }, values, operationId: newOperationId() };
}

export async function createPreventiveMaintenanceAction(
  _prevState: PreventiveFormState,
  formData: FormData,
): Promise<PreventiveFormState> {
  const values = getPreventiveFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return preventiveError(values, "No tienes permisos para programar mantenimientos.");
  }

  const parsed = preventiveMaintenanceSchema.safeParse({
    id_maquina: formData.get("id_maquina"),
    fecha_programada: formData.get("fecha_programada"),
    responsable: formData.get("responsable") ?? "",
    actividad: formData.get("actividad"),
    estado: formData.get("estado"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    return preventiveError(values, "Revisa los datos del mantenimiento.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  const machine = await prisma.maquina.findUnique({
    where: {
      id_maquina: data.id_maquina,
    },
    select: {
      id_maquina: true,
    },
  });

  if (!machine) {
    const message = "La máquina seleccionada no existe.";

    return preventiveError(values, message, { id_maquina: [message] });
  }

  let idMantenimiento = "";

  try {
    await prisma.$transaction(async (tx) => {
      idMantenimiento = await getNextCorrelativeId(tx, {
        codigoEntidad: "mantenimiento_preventivo",
        prefijo: "MTP",
      });

      await tx.mantenimiento_preventivo.create({
        data: {
          id_mantenimiento: idMantenimiento,
          id_maquina: data.id_maquina,
          id_usuario_programa: session.user.id,
          fecha_programada: data.fecha_programada,
          fecha_realizada:
            data.estado === "realizado" ? data.fecha_programada : null,
          responsable: data.responsable || null,
          actividad: data.actividad,
          estado: data.estado,
          observaciones: data.observaciones || null,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "mantenimiento_preventivo",
        id_registro_afectado: idMantenimiento,
        accion: "crear",
        detalle: `Mantenimiento preventivo programado para la maquina ${data.id_maquina}.`,
        tx,
      });
    });
  } catch {
    return preventiveError(values, "No se pudo programar el mantenimiento. Intenta nuevamente.");
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/preventive");
  revalidatePath("/dashboard/maintenance/machines");

  return preventiveSaved(values, idMantenimiento);
}

export async function updatePreventiveMaintenanceStatusAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const id = formData.get("id_mantenimiento")?.toString() ?? "";
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return rowStatusError(id, "No tienes permisos para cambiar el estado de los mantenimientos.");
  }

  const parsed = preventiveMaintenanceStatusSchema.safeParse({
    id_mantenimiento: formData.get("id_mantenimiento"),
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    return rowStatusError(id, parsed.error.issues.map((issue) => issue.message).join(" "));
  }

  const data = parsed.data;

  let problem: string | null = null;

  try {
    problem = await prisma.$transaction(async (tx) => {
      await lockPreventiveMaintenanceRow(tx, data.id_mantenimiento);

      const maintenance = await tx.mantenimiento_preventivo.findUnique({
        where: {
          id_mantenimiento: data.id_mantenimiento,
        },
        select: {
          id_mantenimiento: true,
          fecha_programada: true,
          estado: true,
        },
      });

      if (!maintenance) {
        return "El mantenimiento seleccionado no existe.";
      }

      if (["realizado", "anulado"].includes(maintenance.estado)) {
        return "No se puede modificar un mantenimiento realizado o anulado.";
      }

      if (maintenance.estado === data.estado) {
        return "El mantenimiento ya estaba en ese estado.";
      }

      await tx.mantenimiento_preventivo.update({
        where: {
          id_mantenimiento: data.id_mantenimiento,
        },
        data: {
          estado: data.estado,
          fecha_realizada:
            data.estado === "realizado" ? new Date() : null,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "mantenimiento_preventivo",
        id_registro_afectado: data.id_mantenimiento,
        accion: "actualizar",
        detalle: `Estado de mantenimiento preventivo actualizado de ${maintenance.estado} a ${data.estado}.`,
        tx,
      });

      return null;
    });
  } catch {
    return rowStatusError(id, "No se pudo cambiar el estado del mantenimiento. Intenta nuevamente.");
  }

  if (problem) {
    return rowStatusError(id, problem);
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/preventive");
  revalidatePath("/dashboard/maintenance/machines");

  return rowStatusDone(id, data.estado);
}
