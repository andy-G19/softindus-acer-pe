"use server";

import { revalidatePath } from "next/cache";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { lockWorkOrderRow } from "@/lib/row-locks";
import { scrapSchema } from "@/schemas/waste-scrap/scrap.schema";

/** Lo que el formulario de chatarra envio, tal cual, para volver a mostrarlo. */
export type ScrapFormValues = {
  id_material: string;
  id_orden_trabajo: string;
  tipo_material: string;
  peso_kg: string;
  cantidad: string;
  observaciones: string;
};

// Entrega 10.7a: el alta se usa desde el panel lateral y devuelve el resultado; sin
// permiso responde con un error, no redirige.
export type ScrapFormState = FormActionState<ScrapFormValues, { id_chatarra: string }>;

type ScrapProblem = { error: string; fieldErrors?: FieldErrors };

const PERMISSION_ERROR = "No tienes permisos para registrar chatarra.";

function getScrapFormValues(formData: FormData): ScrapFormValues {
  const text = (name: keyof ScrapFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_material: text("id_material"),
    id_orden_trabajo: text("id_orden_trabajo"),
    tipo_material: text("tipo_material"),
    peso_kg: text("peso_kg"),
    cantidad: text("cantidad"),
    observaciones: text("observaciones"),
  };
}

function scrapError(values: ScrapFormValues, error: string, fieldErrors?: FieldErrors): ScrapFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

const materialProblem = (error: string): ScrapProblem => ({ error, fieldErrors: { id_material: [error] } });
const orderProblem = (error: string): ScrapProblem => ({ error, fieldErrors: { id_orden_trabajo: [error] } });

export async function createScrapAction(
  _prevState: ScrapFormState,
  formData: FormData,
): Promise<ScrapFormState> {
  const values = getScrapFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return scrapError(values, PERMISSION_ERROR);
  }

  const parsedData = scrapSchema.safeParse({
    id_material: formData.get("id_material"),
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    tipo_material: formData.get("tipo_material"),
    peso_kg: formData.get("peso_kg"),
    cantidad: formData.get("cantidad"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsedData.success) {
    return scrapError(values, "Revisa los datos de la chatarra.", parsedData.error.flatten().fieldErrors);
  }

  const data = parsedData.data;

  let outcome: ScrapProblem | { idChatarra: string };

  try {
    // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
    outcome = await prisma.$transaction(async (tx): Promise<ScrapProblem | { idChatarra: string }> => {
      // La orden se bloquea antes de leerla: anularla a la vez queda en fila.
      if (data.id_orden_trabajo) {
        await lockWorkOrderRow(tx, data.id_orden_trabajo);
      }

      if (data.id_material) {
        const material = await tx.material.findUnique({
          where: {
            id_material: data.id_material,
          },
          select: {
            id_material: true,
            estado: true,
          },
        });

        if (!material) {
          return materialProblem("El material de origen seleccionado no existe.");
        }

        if (!material.estado) {
          return materialProblem("No se puede registrar chatarra de un material inactivo.");
        }
      }

      if (data.id_orden_trabajo) {
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
          return orderProblem("No se puede asociar chatarra a una orden anulada.");
        }
      }

      const idChatarra = await getNextCorrelativeId(tx, {
        codigoEntidad: "chatarra",
        prefijo: "CHA",
      });

      await tx.chatarra.create({
        data: {
          id_chatarra: idChatarra,
          id_material: data.id_material,
          id_orden_trabajo: data.id_orden_trabajo,
          tipo_material: data.tipo_material,
          peso_kg: data.peso_kg ?? null,
          cantidad: data.cantidad ?? null,
          estado: "acumulada",
          observaciones: data.observaciones,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "chatarra",
        id_registro_afectado: idChatarra,
        accion: "crear",
        detalle: `Chatarra registrada: ${data.tipo_material}`,
        tx,
      });

      return { idChatarra };
    });
  } catch {
    outcome = { error: "No se pudo registrar la chatarra. Intenta nuevamente." };
  }

  if ("error" in outcome) {
    return scrapError(values, outcome.error, outcome.fieldErrors);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");
  revalidatePath("/dashboard/waste-scrap/scraps");

  return { status: "success", data: { id_chatarra: outcome.idChatarra }, values, operationId: newOperationId() };
}
