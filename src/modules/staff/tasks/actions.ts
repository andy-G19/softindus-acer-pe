"use server";

import { revalidatePath } from "next/cache";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { APP_ROLES } from "@/lib/permissions";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockWorkOrderRow } from "@/lib/row-locks";
import { operatorTaskSchema } from "@/schemas/staff/operator-task.schema";

/** Lo que el formulario de tarea envio, para volver a mostrarlo. */
export type OperatorTaskFormValues = {
  id_operario: string;
  id_orden_trabajo: string;
  id_etapa_ruta: string;
  fecha_tarea: string;
  descripcion: string;
  horas_dedicadas: string;
  estado: string;
  observaciones: string;
};

// Entrega 10.8a: el registro de tareas se usa desde el panel lateral y anular desde
// la fila (ConfirmActionButton); las dos acciones devuelven el resultado y sin
// permiso responden con un error, no lanzan ni redirigen.
export type OperatorTaskFormState = FormActionState<OperatorTaskFormValues, { id_tarea_operario: string }>;

const TASKS_PATH = "/dashboard/staff/tasks";
const PERMISSION_ERROR = "No tienes permisos para registrar tareas.";
const INVALID_DATA = "Revisa los datos de la tarea.";

function getOperatorTaskFormValues(formData: FormData): OperatorTaskFormValues {
  const text = (name: keyof OperatorTaskFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_operario: text("id_operario"),
    id_orden_trabajo: text("id_orden_trabajo"),
    id_etapa_ruta: text("id_etapa_ruta"),
    fecha_tarea: text("fecha_tarea"),
    descripcion: text("descripcion"),
    horas_dedicadas: text("horas_dedicadas"),
    estado: text("estado"),
    observaciones: text("observaciones"),
  };
}

function taskError(values: OperatorTaskFormValues, error: string, fieldErrors?: FieldErrors): OperatorTaskFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

/** Un rechazo de negocio y el campo que lo explica. */
type TaskProblem = { error: string; field: "id_operario" | "id_orden_trabajo" | "id_etapa_ruta" };

export async function createOperatorTaskAction(
  _prevState: OperatorTaskFormState,
  formData: FormData,
): Promise<OperatorTaskFormState> {
  const values = getOperatorTaskFormValues(formData);
  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return taskError(values, PERMISSION_ERROR);
  }

  const parsed = operatorTaskSchema.safeParse(values);

  if (!parsed.success) {
    return taskError(values, INVALID_DATA, parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const selectedStageId = data.id_etapa_ruta || null;

  // Hallazgo 63: la tarea depende de la orden (que no este anulada, su ruta), del
  // operario y de la etapa. Bloquea la orden, el padre, antes de leerla y del
  // correlativo, y decide y escribe en la misma transaccion; un rechazo se
  // devuelve desde ella, antes de escribir, con el campo que lo explica.
  const outcome = await prisma.$transaction(
    async (tx): Promise<TaskProblem | { idTareaOperario: string }> => {
      await lockWorkOrderRow(tx, data.id_orden_trabajo);

      const operator = await tx.operario.findFirst({
        where: {
          id_operario: data.id_operario,
          estado: "activo",
        },
        select: {
          id_operario: true,
        },
      });

      if (!operator) {
        return { error: "El operario seleccionado no existe o está inactivo.", field: "id_operario" };
      }

      const workOrder = await tx.orden_trabajo.findFirst({
        where: {
          id_orden_trabajo: data.id_orden_trabajo,
          estado: {
            not: "anulada",
          },
        },
        select: {
          id_orden_trabajo: true,
          id_ruta: true,
        },
      });

      if (!workOrder) {
        return { error: "La orden de trabajo seleccionada no existe o está anulada.", field: "id_orden_trabajo" };
      }

      if (selectedStageId) {
        const selectedStage = await tx.etapa_ruta.findUnique({
          where: {
            id_etapa_ruta: selectedStageId,
          },
          select: {
            id_etapa_ruta: true,
            id_ruta: true,
            estado: true,
          },
        });

        if (!selectedStage || !selectedStage.estado) {
          return { error: "La etapa seleccionada no existe o está inactiva.", field: "id_etapa_ruta" };
        }

        if (!workOrder.id_ruta) {
          return {
            error: "La orden de trabajo seleccionada no tiene una ruta de fabricación asignada.",
            field: "id_etapa_ruta",
          };
        }

        if (selectedStage.id_ruta !== workOrder.id_ruta) {
          return {
            error: "La etapa seleccionada no pertenece a la ruta de fabricación de la orden.",
            field: "id_etapa_ruta",
          };
        }
      }

      const idTareaOperario = await getNextCorrelativeId(tx, {
        codigoEntidad: "tarea_operario",
        prefijo: "TAR",
      });

      await tx.tarea_operario.create({
        data: {
          id_tarea_operario: idTareaOperario,
          id_operario: data.id_operario,
          id_orden_trabajo: data.id_orden_trabajo,
          id_etapa_ruta: selectedStageId,
          id_usuario_registro: session.user.id,
          fecha_tarea: data.fecha_tarea,
          descripcion: data.descripcion,
          // Hallazgo 62: la columna numeric(5,2) redondea; toFixed redondeaba sobre
          // el binario y 3.005 quedaba en 3.00 en lugar de 3.01.
          horas_dedicadas:
            data.horas_dedicadas === null
              ? null
              : String(data.horas_dedicadas),
          estado: data.estado,
          observaciones: data.observaciones || null,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "tarea_operario",
        id_registro_afectado: idTareaOperario,
        accion: "crear",
        detalle: `Tarea registrada para el operario ${data.id_operario} en la orden ${data.id_orden_trabajo}.`,
        tx,
      });

      return { idTareaOperario };
    },
  );

  if ("error" in outcome) {
    return taskError(values, outcome.error, { [outcome.field]: [outcome.error] });
  }

  revalidatePath("/dashboard/staff");
  revalidatePath(TASKS_PATH);

  return {
    status: "success",
    data: { id_tarea_operario: outcome.idTareaOperario },
    values,
    operationId: newOperationId(),
  };
}

// Entrega 10.8a: anular desde la fila con ConfirmActionButton; devuelve el
// resultado. Un rechazo no revalida: la lista repintada quitaria el boton y su
// mensaje.
export async function cancelOperatorTaskAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const idTareaOperario = formData.get("id_tarea_operario")?.toString().trim() ?? "";
  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return rowStatusError(idTareaOperario, PERMISSION_ERROR);
  }

  if (!idTareaOperario) {
    return rowStatusError(idTareaOperario, "No se recibió la tarea del operario.");
  }

  // Hallazgo 61: anula solo si la tarea no lo esta ya, comparando y escribiendo
  // en una sola sentencia, con la bitacora en la misma transaccion. Con count 0
  // lee la tarea solo para explicar el rechazo: un doble clic no deja dos
  // bitacoras.
  const problem = await prisma.$transaction(async (tx): Promise<string | null> => {
    const { count } = await tx.tarea_operario.updateMany({
      where: {
        id_tarea_operario: idTareaOperario,
        estado: { not: "anulada" },
      },
      data: {
        estado: "anulada",
      },
    });

    if (count === 0) {
      const task = await tx.tarea_operario.findUnique({
        where: {
          id_tarea_operario: idTareaOperario,
        },
        select: {
          id_tarea_operario: true,
        },
      });

      return task
        ? "La tarea ya se encuentra anulada."
        : "La tarea seleccionada no existe.";
    }

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "tarea_operario",
      id_registro_afectado: idTareaOperario,
      accion: "anular",
      detalle: `Tarea de operario anulada: ${idTareaOperario}.`,
      tx,
    });

    return null;
  });

  if (problem) {
    return rowStatusError(idTareaOperario, problem);
  }

  revalidatePath("/dashboard/staff");
  revalidatePath(TASKS_PATH);

  return rowStatusDone(idTareaOperario, "anulada");
}
