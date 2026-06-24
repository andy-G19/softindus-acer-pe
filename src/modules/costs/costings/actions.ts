"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));

  if (Number.isNaN(currentNumber)) {
    return `${prefix}00000001`;
  }

  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function normalizeText(value: FormDataEntryValue | null) {
  if (!value) {
    return "";
  }

  return String(value).trim();
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

  if (workOrder.version_receta.estado !== "vigente") {
    throw new Error(
      "La versión de receta asociada a la orden ya no está vigente.",
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

  const laborCost = 0;
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

  const idCosteo = buildSequentialId(lastCosting?.id_costeo, "COS");

  await prisma.costeo.create({
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
        "Costeo generado automáticamente desde orden de trabajo usando la receta técnica vigente y el costo unitario actual de los materiales.",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/costs/work-orders");
  revalidatePath("/dashboard/production/work-orders");

  redirect(`/dashboard/costs/costings/${idCosteo}`);
}