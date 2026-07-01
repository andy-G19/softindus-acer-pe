"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import {
  calculateEstimatedLaborCost,
  recalculateCostingTotals,
} from "@/lib/costing";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { laborCostSchema } from "@/schemas/costs/labor-cost.schema";

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value.toString());

  if (Number.isNaN(numberValue) || numberValue < 0) {
    return 0;
  }

  return numberValue;
}

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

export async function createCostingFromWorkOrderAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const idOrdenTrabajo = normalizeText(formData.get("id_orden_trabajo"));

  if (!idOrdenTrabajo) {
    throw new Error("Debe seleccionar una orden de trabajo válida.");
  }

  const existingCosting = await prisma.costeo.findFirst({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    select: {
      id_costeo: true,
    },
  });

  if (existingCosting) {
    redirect(`/dashboard/costs/costings/${existingCosting.id_costeo}`);
  }

  const workOrder = await prisma.orden_trabajo.findUnique({
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
    throw new Error("La orden de trabajo seleccionada no existe.");
  }

  if (workOrder.estado === "anulada") {
    throw new Error("No se puede generar costeo para una orden anulada.");
  }

  if (!workOrder.version_receta) {
    throw new Error(
      "La orden de trabajo no tiene una versión de receta asociada.",
    );
  }

  if (workOrder.version_receta.estado === "anulada") {
    throw new Error(
      "La versión de receta asociada a la orden está anulada y no puede costearse.",
    );
  }

  if (workOrder.version_receta.detalle_receta.length === 0) {
    throw new Error(
      "La versión de receta no tiene materiales registrados para calcular el costeo.",
    );
  }

  const quantityToProduce = toNumber(workOrder.cantidad);

  if (quantityToProduce <= 0) {
    throw new Error("La cantidad de la orden debe ser mayor que cero.");
  }

  let materialCost = 0;
  let consumableCost = 0;

  for (const detail of workOrder.version_receta.detalle_receta) {
    const quantityPerUnit = toNumber(detail.cantidad_requerida);
    const wastePercentage = toNumber(detail.merma_estimada_porcentaje);
    const unitCost = toNumber(detail.material.costo_unitario_actual);

    const requiredBase = quantityPerUnit * quantityToProduce;
    const requiredWithWaste = requiredBase * (1 + wastePercentage / 100);
    const estimatedCost = requiredWithWaste * unitCost;

    if (detail.tipo_consumo === "materia_prima") {
      materialCost += estimatedCost;
    } else {
      consumableCost += estimatedCost;
    }
  }

  const laborCost = await calculateEstimatedLaborCost(
    prisma,
    workOrder.id_orden_trabajo,
  );
  const indirectCostTotal = 0;
  const totalCost =
    materialCost + consumableCost + laborCost + indirectCostTotal;
  const unitCost = totalCost / quantityToProduce;

  const lastCosting = await prisma.costeo.findFirst({
    orderBy: {
      id_costeo: "desc",
    },
    select: {
      id_costeo: true,
    },
  });

  const idCosteo = buildNextId("COS", lastCosting?.id_costeo);

  await prisma.$transaction(async (tx) => {
    await tx.costeo.create({
      data: {
        id_costeo: idCosteo,
        id_pedido: workOrder.detalle_pedido?.id_pedido ?? null,
        id_orden_trabajo: workOrder.id_orden_trabajo,
        id_usuario_registro: session.user.id,
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
      userId: session.user.id,
      entidad_afectada: "costeo",
      id_registro_afectado: idCosteo,
      accion: "crear",
      detalle: `Costeo creado desde la orden de trabajo ${workOrder.id_orden_trabajo}. Mano de obra estimada: S/ ${laborCost.toFixed(2)}.`,
      tx,
    });
  });

  revalidateCostingPaths(idCosteo);
  revalidatePath("/dashboard/production/work-orders");

  redirect(`/dashboard/costs/costings/${idCosteo}`);
}

export async function updateLaborCostAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsedData = laborCostSchema.safeParse({
    id_costeo: formData.get("id_costeo"),
    costo_mano_obra: formData.get("costo_mano_obra"),
  });

  if (!parsedData.success) {
    const message = parsedData.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsedData.data;

  await prisma.$transaction(async (tx) => {
    const costing = await tx.costeo.findUnique({
      where: {
        id_costeo: data.id_costeo,
      },
      select: {
        id_costeo: true,
      },
    });

    if (!costing) {
      throw new Error("El costeo seleccionado no existe.");
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
  });

  revalidateCostingPaths(data.id_costeo);

  redirect(`/dashboard/costs/costings/${data.id_costeo}`);
}

export async function recalculateCostingAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const idCosteo = normalizeText(formData.get("id_costeo"));

  if (!idCosteo) {
    throw new Error("Debe seleccionar un costeo válido.");
  }

  await prisma.$transaction(async (tx) => {
    const costing = await tx.costeo.findUnique({
      where: {
        id_costeo: idCosteo,
      },
      select: {
        id_costeo: true,
      },
    });

    if (!costing) {
      throw new Error("El costeo seleccionado no existe.");
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
  });

  revalidateCostingPaths(idCosteo);

  redirect(`/dashboard/costs/costings/${idCosteo}`);
}
