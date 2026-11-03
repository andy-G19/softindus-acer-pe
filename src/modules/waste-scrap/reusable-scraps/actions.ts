"use server";

import { revalidatePath } from "next/cache";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { lockWorkOrderRow } from "@/lib/row-locks";
import { reusableScrapSchema } from "@/schemas/waste-scrap/reusable-scrap.schema";

/** Lo que el formulario de retazo envio, tal cual, para volver a mostrarlo. */
export type ReusableScrapFormValues = {
  id_material: string;
  id_orden_trabajo: string;
  medida_aproximada: string;
  cantidad: string;
  unidad_medida: string;
  ubicacion: string;
};

// Entrega 10.7a: el alta se usa desde el panel lateral y devuelve el resultado; sin
// permiso responde con un error, no redirige.
export type ReusableScrapFormState = FormActionState<ReusableScrapFormValues, { id_retazo: string }>;

type ReusableScrapProblem = { error: string; fieldErrors?: FieldErrors };

const PERMISSION_ERROR = "No tienes permisos para registrar retazos.";

function getReusableScrapFormValues(formData: FormData): ReusableScrapFormValues {
  const text = (name: keyof ReusableScrapFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_material: text("id_material"),
    id_orden_trabajo: text("id_orden_trabajo"),
    medida_aproximada: text("medida_aproximada"),
    cantidad: text("cantidad"),
    unidad_medida: text("unidad_medida"),
    ubicacion: text("ubicacion"),
  };
}

function reusableScrapError(
  values: ReusableScrapFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): ReusableScrapFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

const materialProblem = (error: string): ReusableScrapProblem => ({ error, fieldErrors: { id_material: [error] } });
const orderProblem = (error: string): ReusableScrapProblem => ({ error, fieldErrors: { id_orden_trabajo: [error] } });

export async function createReusableScrapAction(
  _prevState: ReusableScrapFormState,
  formData: FormData,
): Promise<ReusableScrapFormState> {
  const values = getReusableScrapFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return reusableScrapError(values, PERMISSION_ERROR);
  }

  const parsedData = reusableScrapSchema.safeParse({
    id_material: formData.get("id_material"),
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    medida_aproximada: formData.get("medida_aproximada"),
    cantidad: formData.get("cantidad"),
    unidad_medida: formData.get("unidad_medida"),
    ubicacion: formData.get("ubicacion"),
  });

  if (!parsedData.success) {
    return reusableScrapError(values, "Revisa los datos del retazo.", parsedData.error.flatten().fieldErrors);
  }

  const data = parsedData.data;

  let outcome: ReusableScrapProblem | { idRetazo: string };

  try {
    // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
    outcome = await prisma.$transaction(async (tx): Promise<ReusableScrapProblem | { idRetazo: string }> => {
      // La orden se bloquea antes de leerla: anularla a la vez queda en fila.
      await lockWorkOrderRow(tx, data.id_orden_trabajo);

      const material = await tx.material.findUnique({
        where: {
          id_material: data.id_material,
        },
        select: {
          id_material: true,
          nombre_material: true,
          categoria: true,
          unidad_medida: true,
          estado: true,
        },
      });

      if (!material) {
        return materialProblem("El material seleccionado no existe.");
      }

      if (!material.estado) {
        return materialProblem("No se puede registrar retazos de un material inactivo.");
      }

      const workOrder = await tx.orden_trabajo.findUnique({
        where: {
          id_orden_trabajo: data.id_orden_trabajo,
        },
        select: {
          id_orden_trabajo: true,
          estado: true,
        },
      });

      if (!workOrder) {
        return orderProblem("La orden de trabajo seleccionada no existe.");
      }

      if (workOrder.estado === "anulada") {
        return orderProblem("No se puede asociar un retazo a una orden anulada.");
      }

      const idRetazo = await getNextCorrelativeId(tx, {
        codigoEntidad: "retazo_reutilizable",
        prefijo: "RET",
      });

      await tx.retazo_reutilizable.create({
        data: {
          id_retazo: idRetazo,
          id_material: data.id_material,
          id_orden_trabajo: data.id_orden_trabajo,
          tipo_material: material.categoria,
          medida_aproximada: data.medida_aproximada,
          cantidad: data.cantidad,
          unidad_medida: data.unidad_medida,
          ubicacion: data.ubicacion,
          estado: "disponible",
          id_usuario_registro: session.user.id,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "retazo_reutilizable",
        id_registro_afectado: idRetazo,
        accion: "crear",
        detalle: `Retazo reutilizable creado para el material ${data.id_material}.`,
        tx,
      });

      return { idRetazo };
    });
  } catch {
    outcome = { error: "No se pudo registrar el retazo. Intenta nuevamente." };
  }

  if ("error" in outcome) {
    return reusableScrapError(values, outcome.error, outcome.fieldErrors);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");
  revalidatePath("/dashboard/waste-scrap/reusable-scraps");

  return { status: "success", data: { id_retazo: outcome.idRetazo }, values, operationId: newOperationId() };
}
