"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { recalculateCostingTotals } from "@/lib/costing";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { indirectCostSchema } from "@/schemas/costs/indirect-cost.schema";

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
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

  if (idCosteo) {
    revalidatePath(`/dashboard/costs/costings/${idCosteo}`);
  }
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

  const lastIndirectCost = await prisma.costo_indirecto.findFirst({
    orderBy: {
      id_costo_indirecto: "desc",
    },
    select: {
      id_costo_indirecto: true,
    },
  });

  const idCostoIndirecto = buildNextId(
    "CIN",
    lastIndirectCost?.id_costo_indirecto,
  );

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

    await recalculateCostingTotals(tx, data.id_costeo);

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "costo_indirecto",
      id_registro_afectado: idCostoIndirecto,
      accion: "crear",
      detalle: `Costo indirecto agregado al costeo ${data.id_costeo}: ${data.concepto}.`,
      tx,
    });
  });

  revalidateCostingPaths(data.id_costeo);

  redirect(`/dashboard/costs/costings/${data.id_costeo}`);
}

export async function deleteIndirectCostAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const idCostoIndirecto = normalizeText(formData.get("id_costo_indirecto"));

  if (!idCostoIndirecto) {
    throw new Error("Debe seleccionar un costo indirecto válido.");
  }

  let idCosteo = "";

  await prisma.$transaction(async (tx) => {
    const indirectCost = await tx.costo_indirecto.findUnique({
      where: {
        id_costo_indirecto: idCostoIndirecto,
      },
      select: {
        id_costo_indirecto: true,
        id_costeo: true,
        concepto: true,
      },
    });

    if (!indirectCost) {
      throw new Error("El costo indirecto seleccionado no existe.");
    }

    if (!indirectCost.id_costeo) {
      throw new Error("El costo indirecto no está asociado a un costeo.");
    }

    idCosteo = indirectCost.id_costeo;

    await tx.costo_indirecto.delete({
      where: {
        id_costo_indirecto: idCostoIndirecto,
      },
    });

    await recalculateCostingTotals(tx, idCosteo);

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "costo_indirecto",
      id_registro_afectado: idCostoIndirecto,
      accion: "eliminar",
      detalle: `Costo indirecto eliminado del costeo ${idCosteo}: ${indirectCost.concepto}.`,
      tx,
    });
  });

  revalidateCostingPaths(idCosteo);

  redirect(`/dashboard/costs/costings/${idCosteo}`);
}
