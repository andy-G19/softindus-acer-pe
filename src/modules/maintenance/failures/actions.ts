"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { lockFailureRow, lockMachineRow } from "@/lib/row-locks";
import {
  failureSchema,
  failureStatusSchema,
} from "@/schemas/maintenance/failure.schema";

/** Lo que el formulario de falla envio, tal cual, para volver a mostrarlo. */
export type FailureFormValues = {
  id_maquina: string;
  fecha_falla: string;
  descripcion: string;
  responsable_registro: string;
  estado_atencion: string;
  tiempo_perdido_horas: string;
  impacto_produccion: string;
};

// Entrega 10.5b: el alta de fallas no redirige; devuelve el resultado y el
// formulario da el aviso y cierra el panel o vuelve al listado. Sin permiso
// responde con un error, no redirige. El cambio de estado sigue redirigiendo.
export type FailureFormState = FormActionState<FailureFormValues, { id_falla: string }>;

async function requireMaintenanceRole() {
  return requireRole(["ADMIN", "WORKSHOP_MASTER"]);
}

function getFailureFormValues(formData: FormData): FailureFormValues {
  const text = (name: keyof FailureFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_maquina: text("id_maquina"),
    fecha_falla: text("fecha_falla"),
    descripcion: text("descripcion"),
    responsable_registro: text("responsable_registro"),
    estado_atencion: text("estado_atencion"),
    tiempo_perdido_horas: text("tiempo_perdido_horas"),
    impacto_produccion: text("impacto_produccion"),
  };
}

function failureError(values: FailureFormValues, error: string, fieldErrors?: FieldErrors): FailureFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function failureSaved(values: FailureFormValues, idFalla: string): FailureFormState {
  return { status: "success", data: { id_falla: idFalla }, values, operationId: newOperationId() };
}

export async function createFailureAction(
  _prevState: FailureFormState,
  formData: FormData,
): Promise<FailureFormState> {
  const values = getFailureFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return failureError(values, "No tienes permisos para registrar fallas.");
  }

  const parsed = failureSchema.safeParse({
    id_maquina: formData.get("id_maquina"),
    fecha_falla: formData.get("fecha_falla"),
    descripcion: formData.get("descripcion"),
    responsable_registro: formData.get("responsable_registro") ?? "",
    estado_atencion: formData.get("estado_atencion"),
    tiempo_perdido_horas: formData.get("tiempo_perdido_horas") ?? "",
    impacto_produccion: formData.get("impacto_produccion") ?? "",
  });

  if (!parsed.success) {
    return failureError(values, "Revisa los datos de la falla.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  let idFalla = "";
  let machineProblem: string | null = null;

  try {
    machineProblem = await prisma.$transaction(async (tx) => {
      await lockMachineRow(tx, data.id_maquina);

      const machine = await tx.maquina.findUnique({
        where: {
          id_maquina: data.id_maquina,
        },
        select: {
          id_maquina: true,
          estado: true,
        },
      });

      if (!machine) {
        return "La máquina seleccionada no existe.";
      }

      if (["inactiva", "dada_de_baja"].includes(machine.estado)) {
        return "No se puede registrar una falla sobre una maquina inactiva.";
      }

      idFalla = await getNextCorrelativeId(tx, {
        codigoEntidad: "falla_maquina",
        prefijo: "FAL",
      });

      await tx.falla_maquina.create({
        data: {
          id_falla: idFalla,
          id_maquina: data.id_maquina,
          id_usuario_registro: session.user.id,
          fecha_falla: data.fecha_falla,
          descripcion: data.descripcion,
          responsable_registro: data.responsable_registro || null,
          estado_atencion: data.estado_atencion,
          tiempo_perdido_horas: data.tiempo_perdido_horas,
          impacto_produccion: data.impacto_produccion || null,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "falla_maquina",
        id_registro_afectado: idFalla,
        accion: "crear",
        detalle: `Falla registrada para la maquina ${data.id_maquina}.`,
        tx,
      });

      return null;
    });
  } catch {
    return failureError(values, "No se pudo registrar la falla. Intenta nuevamente.");
  }

  if (machineProblem) {
    return failureError(values, machineProblem, { id_maquina: [machineProblem] });
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/failures");
  revalidatePath("/dashboard/maintenance/machines");

  return failureSaved(values, idFalla);
}

export async function updateFailureStatusAction(formData: FormData) {
  const session = await requireMaintenanceRole();

  const parsed = failureStatusSchema.safeParse({
    id_falla: formData.get("id_falla"),
    estado_atencion: formData.get("estado_atencion"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    await lockFailureRow(tx, data.id_falla);

    const failure = await tx.falla_maquina.findUnique({
      where: {
        id_falla: data.id_falla,
      },
      select: {
        id_falla: true,
        estado_atencion: true,
      },
    });

    if (!failure) {
      throw new Error("La falla seleccionada no existe.");
    }

    if (["reparada", "anulada"].includes(failure.estado_atencion)) {
      throw new Error("No se puede modificar una falla cerrada o anulada.");
    }

    await tx.falla_maquina.update({
      where: {
        id_falla: data.id_falla,
      },
      data: {
        estado_atencion: data.estado_atencion,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "falla_maquina",
      id_registro_afectado: data.id_falla,
      accion: "actualizar",
      detalle: `Estado de falla actualizado de ${failure.estado_atencion} a ${data.estado_atencion}.`,
      tx,
    });
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/failures");

  redirect("/dashboard/maintenance/failures?toast=failure-updated");
}
