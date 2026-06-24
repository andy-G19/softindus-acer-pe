"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { indirectCostSchema } from "@/schemas/costs/indirect-cost.schema";

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

export async function createIndirectCostAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsedData = indirectCostSchema.safeParse({
    id_costeo: formData.get("id_costeo"),
    concepto: formData.get("concepto"),
    categoria: formData.get("categoria"),
    monto: formData.get("monto"),
    criterio_prorrateo: formData.get("criterio_prorrateo"),
    periodo: formData.get("periodo"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsedData.success) {
    const message = parsedData.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsedData.data;

  const costing = await prisma.costeo.findUnique({
    where: {
      id_costeo: data.id_costeo,
    },
    include: {
      costo_indirecto: true,
    },
  });

  if (!costing) {
    throw new Error("El costeo seleccionado no existe.");
  }

  const lastIndirectCost = await prisma.costo_indirecto.findFirst({
    orderBy: {
      id_costo_indirecto: "desc",
    },
    select: {
      id_costo_indirecto: true,
    },
  });

  const idCostoIndirecto = buildSequentialId(
    lastIndirectCost?.id_costo_indirecto,
    "CIN",
  );

  await prisma.$transaction(async (tx) => {
    await tx.costo_indirecto.create({
      data: {
        id_costo_indirecto: idCostoIndirecto,
        id_costeo: data.id_costeo,
        concepto: data.concepto,
        categoria: data.categoria,
        monto: data.monto,
        criterio_prorrateo: data.criterio_prorrateo,
        periodo: data.periodo,
        observaciones: data.observaciones,
      },
    });

    const indirectCosts = await tx.costo_indirecto.findMany({
      where: {
        id_costeo: data.id_costeo,
      },
      select: {
        monto: true,
      },
    });

    const indirectCostTotal = indirectCosts.reduce((total, item) => {
      return total + toNumber(item.monto);
    }, 0);

    const totalCost =
      toNumber(costing.costo_materiales) +
      toNumber(costing.costo_consumibles) +
      toNumber(costing.costo_mano_obra) +
      indirectCostTotal;

    const baseQuantity = toNumber(costing.cantidad_base);
    const unitCost = baseQuantity > 0 ? totalCost / baseQuantity : null;

    await tx.costeo.update({
      where: {
        id_costeo: data.id_costeo,
      },
      data: {
        costo_indirecto_total: indirectCostTotal,
        costo_total: totalCost,
        costo_unitario: unitCost,
      },
    });
  });

  revalidatePath("/dashboard/costs");
  revalidatePath(`/dashboard/costs/costings/${data.id_costeo}`);

  redirect(`/dashboard/costs/costings/${data.id_costeo}`);
}