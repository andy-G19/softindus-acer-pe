"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import {
  calculateEstimatedLaborCost,
  recalculateCostingTotals,
} from "@/lib/costing";
import { estimateMaterialCost } from "@/lib/costing-calculations";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { toNonNegativeNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockCostingRow, lockWorkOrderRow } from "@/lib/row-locks";
import { laborCostSchema } from "@/schemas/costs/labor-cost.schema";

const PERMISSION_ERROR = "No tienes permisos para gestionar costeos.";
const COSTING_NOT_FOUND = "El costeo seleccionado no existe.";

function normalizeText(value: FormDataEntryValue | null) {
  if (!value) {
    return "";
  }

  return String(value).trim();
}

function revalidateCostingPaths(idCosteo?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/costs/costings");
  revalidatePath("/dashboard/costs/work-orders");

  if (idCosteo) {
    revalidatePath(`/dashboard/costs/costings/${idCosteo}`);
  }
}

type CostingFromWorkOrderResult = {
  idCosteo: string;
  existente: boolean;
};

/**
 * Genera el costeo de la orden, o devuelve el que ya tiene, dentro de la transaccion que
 * recibe. No se exporta: en un modulo "use server" seria un endpoint.
 *
 * Bloquea la orden antes de la primera lectura (H4): con un doble envio, el segundo espera
 * a que el primero confirme y encuentra su costeo, en lugar de crear otro. La comprobacion,
 * las validaciones de la orden y la creacion conservan el orden que tenian.
 */
async function createCostingInTransaction(
  tx: Prisma.TransactionClient,
  idOrdenTrabajo: string,
  idUsuario: string,
): Promise<CostingFromWorkOrderResult | { problem: string }> {
  await lockWorkOrderRow(tx, idOrdenTrabajo);

  const existingCosting = await tx.costeo.findFirst({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    select: {
      id_costeo: true,
    },
  });

  if (existingCosting) {
    return { idCosteo: existingCosting.id_costeo, existente: true };
  }

  const workOrder = await tx.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    include: {
      detalle_pedido: true,
      producto: true,
      version_receta: {
        include: {
          receta_tecnica: true,
          detalle_receta: {
            include: {
              material: true,
            },
          },
        },
      },
    },
  });

  if (!workOrder) {
    return { problem: "La orden de trabajo seleccionada no existe." };
  }

  if (workOrder.estado === "anulada") {
    return { problem: "No se puede generar costeo para una orden anulada." };
  }

  if (!workOrder.version_receta) {
    return { problem: "La orden de trabajo no tiene una versión de receta asociada." };
  }

  if (workOrder.version_receta.estado === "anulada") {
    return { problem: "La versión de receta asociada a la orden está anulada y no puede costearse." };
  }

  if (workOrder.version_receta.detalle_receta.length === 0) {
    return { problem: "La versión de receta no tiene materiales registrados para calcular el costeo." };
  }

  const quantityToProduce = toNonNegativeNumber(workOrder.cantidad);

  if (quantityToProduce <= 0) {
    return { problem: "La cantidad de la orden debe ser mayor que cero." };
  }

  let materialCost = 0;
  let consumableCost = 0;

  for (const detail of workOrder.version_receta.detalle_receta) {
    const quantityPerUnit = toNonNegativeNumber(detail.cantidad_requerida);
    const wastePercentage = toNonNegativeNumber(detail.merma_estimada_porcentaje);
    const unitCost = toNonNegativeNumber(detail.material.costo_unitario_actual);

    const { estimatedCost } = estimateMaterialCost({
      quantityToProduce,
      quantityPerUnit,
      wastePercentage,
      unitCost,
    });

    if (detail.tipo_consumo === "materia_prima") {
      materialCost += estimatedCost;
    } else {
      consumableCost += estimatedCost;
    }
  }

  const laborCost = await calculateEstimatedLaborCost(
    tx,
    workOrder.id_orden_trabajo,
  );
  const indirectCostTotal = 0;
  const totalCost =
    materialCost + consumableCost + laborCost + indirectCostTotal;
  const unitCost = totalCost / quantityToProduce;

  const idCosteo = await getNextCorrelativeId(tx, {
    codigoEntidad: "costeo",
    prefijo: "COS",
  });

  await tx.costeo.create({
    data: {
      id_costeo: idCosteo,
      id_pedido: workOrder.detalle_pedido?.id_pedido ?? null,
      id_orden_trabajo: workOrder.id_orden_trabajo,
      id_usuario_registro: idUsuario,
      costo_materiales: materialCost,
      costo_consumibles: consumableCost,
      costo_mano_obra: laborCost,
      costo_indirecto_total: indirectCostTotal,
      costo_total: totalCost,
      costo_unitario: unitCost,
      cantidad_base: quantityToProduce,
      observaciones:
        "Costeo generado automáticamente desde orden de trabajo usando la versión de receta guardada en la orden, costo actual de materiales y mano de obra estimada desde tareas de operario.",
    },
  });

  await registerAuditLog({
    userId: idUsuario,
    entidad_afectada: "costeo",
    id_registro_afectado: idCosteo,
    accion: "crear",
    detalle: `Costeo creado desde la orden de trabajo ${workOrder.id_orden_trabajo}. Mano de obra estimada: S/ ${laborCost.toFixed(2)}.`,
    tx,
  });

  return { idCosteo, existente: false };
}

/**
 * Lo que el boton de generar envio, para un rechazo. Con exito no responde: redirige al
 * costeo (hallazgo 95 de la 10.8b).
 */
export type CostingFromWorkOrderState = FormActionState<{ id_orden_trabajo: string }, never>;

const COSTINGS_PATH = "/dashboard/costs/costings";

// B6 de la 10.8b (D5): generar se pide desde la lista de ordenes con ConfirmActionButton.
// Un rechazo responde con el error, que queda en la confirmacion, y no revalida. Con exito
// redirige al costeo con su aviso en la URL: el creado, o el que la orden ya tenia (una
// lista vieja o un doble clic), sin escribir ni revalidar. Hallazgo 95: navegar en el
// cliente con router.push despues de la respuesta chocaba con la navegacion que Next
// aplica por la revalidacion, y el historial perdia la entrada de las ordenes por costear;
// el redirect lo aplica el propio reductor de la accion, con push.
export async function createCostingFromWorkOrderAction(
  _prevState: CostingFromWorkOrderState,
  formData: FormData,
): Promise<CostingFromWorkOrderState> {
  const idOrdenTrabajo = normalizeText(formData.get("id_orden_trabajo"));
  const values = { id_orden_trabajo: idOrdenTrabajo };
  const fail = (error: string): CostingFromWorkOrderState => ({
    status: "error",
    error,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail(PERMISSION_ERROR);
  }

  if (!idOrdenTrabajo) {
    return fail("Debe seleccionar una orden de trabajo válida.");
  }

  const result = await prisma.$transaction((tx) =>
    createCostingInTransaction(tx, idOrdenTrabajo, session.user.id),
  );

  if ("problem" in result) {
    return fail(result.problem);
  }

  if (result.existente) {
    redirect(`${COSTINGS_PATH}/${result.idCosteo}?toast=costing-already-exists`);
  }

  revalidateCostingPaths(result.idCosteo);
  revalidatePath("/dashboard/production/work-orders");
  redirect(`${COSTINGS_PATH}/${result.idCosteo}?toast=costing-created`);
}

/** Lo que el formulario de mano de obra envio, para volver a mostrarlo. */
export type LaborCostFormValues = {
  costo_mano_obra: string;
};

// B4 de la 10.8b (D4): la mano de obra se ajusta desde su seccion del detalle y la accion
// devuelve el resultado; sin permiso responde con un error, no redirige. El detalle se
// repinta por la revalidacion.
export type LaborCostFormState = FormActionState<LaborCostFormValues, { id_costeo: string }>;

export async function updateLaborCostAction(
  _prevState: LaborCostFormState,
  formData: FormData,
): Promise<LaborCostFormState> {
  const values: LaborCostFormValues = {
    costo_mano_obra: formData.get("costo_mano_obra")?.toString() ?? "",
  };
  const fail = (error: string, fieldErrors?: FieldErrors): LaborCostFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail(PERMISSION_ERROR);
  }

  const parsedData = laborCostSchema.safeParse({
    id_costeo: formData.get("id_costeo"),
    costo_mano_obra: formData.get("costo_mano_obra"),
  });

  if (!parsedData.success) {
    return fail("Revisa el costo de mano de obra.", parsedData.error.flatten().fieldErrors);
  }

  const data = parsedData.data;

  const problem = await prisma.$transaction(async (tx) => {
    // Hallazgo 65 (10.8): se bloquea el costeo antes de comprobarlo y de escribir su mano
    // de obra; antes la escritura llegaba sin bloqueo y solo el recalculo lo tomaba.
    await lockCostingRow(tx, data.id_costeo);

    const costing = await tx.costeo.findUnique({
      where: {
        id_costeo: data.id_costeo,
      },
      select: {
        id_costeo: true,
      },
    });

    // Nada se escribio todavia: el problema se devuelve y la accion responde con el.
    if (!costing) {
      return COSTING_NOT_FOUND;
    }

    await tx.costeo.update({
      where: {
        id_costeo: data.id_costeo,
      },
      data: {
        costo_mano_obra: data.costo_mano_obra,
      },
    });

    await recalculateCostingTotals(tx, data.id_costeo);

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "costeo",
      id_registro_afectado: data.id_costeo,
      accion: "actualizar",
      detalle: `Costo de mano de obra actualizado a S/ ${data.costo_mano_obra.toFixed(2)}.`,
      tx,
    });

    return null;
  });

  if (problem) {
    return fail(problem);
  }

  revalidateCostingPaths(data.id_costeo);

  return {
    status: "success",
    data: { id_costeo: data.id_costeo },
    values,
    operationId: newOperationId(),
  };
}

// B5 de la 10.8b (D6): recalcular se pide desde el detalle con ConfirmActionButton y la
// accion devuelve RowStatusState. Un rechazo no revalida: el repintado se llevaria el
// boton y su mensaje.
export async function recalculateCostingAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const idCosteo = normalizeText(formData.get("id_costeo"));

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return rowStatusError(idCosteo, PERMISSION_ERROR);
  }

  if (!idCosteo) {
    return rowStatusError(idCosteo, "Debe seleccionar un costeo válido.");
  }

  const problem = await prisma.$transaction(async (tx) => {
    // Se bloquea antes de comprobar que existe, como las demas acciones que tocan el costeo.
    await lockCostingRow(tx, idCosteo);

    const costing = await tx.costeo.findUnique({
      where: {
        id_costeo: idCosteo,
      },
      select: {
        id_costeo: true,
      },
    });

    // Nada se escribio todavia: el problema se devuelve y la accion responde con el.
    if (!costing) {
      return COSTING_NOT_FOUND;
    }

    await recalculateCostingTotals(tx, idCosteo);

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "costeo",
      id_registro_afectado: idCosteo,
      accion: "recalcular",
      detalle:
        "Costeo recalculado manteniendo materiales, consumibles y mano de obra, y sumando costos indirectos vigentes.",
      tx,
    });

    return null;
  });

  if (problem) {
    return rowStatusError(idCosteo, problem);
  }

  revalidateCostingPaths(idCosteo);

  return rowStatusDone(idCosteo, "recalculado");
}
