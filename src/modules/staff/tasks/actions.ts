"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { lockWorkOrderRow } from "@/lib/row-locks";
import { operatorTaskSchema } from "@/schemas/staff/operator-task.schema";

async function requireStaffManager() {
  return requireRole(["ADMIN", "WORKSHOP_MASTER"]);
}

export async function createOperatorTaskAction(formData: FormData) {
  const session = await requireStaffManager();

  const parsed = operatorTaskSchema.safeParse({
    id_operario: formData.get("id_operario"),
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    id_etapa_ruta: formData.get("id_etapa_ruta") ?? "",
    fecha_tarea: formData.get("fecha_tarea"),
    descripcion: formData.get("descripcion"),
    horas_dedicadas: formData.get("horas_dedicadas") ?? "",
    estado: formData.get("estado"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;
  const selectedStageId = data.id_etapa_ruta || null;

  // Hallazgo 63: la tarea depende de la orden (que no este anulada, su ruta), del
  // operario y de la etapa. Bloquea la orden, el padre, antes de leerla y del
  // correlativo, y decide y escribe en la misma transaccion; un rechazo se
  // devuelve desde ella, antes de escribir, y se lanza con el mismo mensaje.
  const problem = await prisma.$transaction(async (tx): Promise<string | null> => {
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
      return "El operario seleccionado no existe o está inactivo.";
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
      return "La orden de trabajo seleccionada no existe o está anulada.";
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
        return "La etapa seleccionada no existe o está inactiva.";
      }

      if (!workOrder.id_ruta) {
        return "La orden de trabajo seleccionada no tiene una ruta de fabricación asignada.";
      }

      if (selectedStage.id_ruta !== workOrder.id_ruta) {
        return "La etapa seleccionada no pertenece a la ruta de fabricación de la orden.";
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

    return null;
  });

  if (problem) {
    throw new Error(problem);
  }

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/tasks");

  redirect("/dashboard/staff/tasks?toast=operator-task-created");
}

export async function cancelOperatorTaskAction(formData: FormData) {
  const session = await requireStaffManager();

  const idTareaOperario = String(formData.get("id_tarea_operario") ?? "");

  if (!idTareaOperario) {
    throw new Error("No se recibió la tarea del operario.");
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
    throw new Error(problem);
  }

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/tasks");

  redirect("/dashboard/staff/tasks?toast=operator-task-annulled");
}
