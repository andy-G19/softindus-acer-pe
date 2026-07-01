"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { profitabilitySchema } from "@/schemas/costs/profitability.schema";

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

export async function createProfitabilityAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsedData = profitabilitySchema.safeParse({
    id_costeo: formData.get("id_costeo"),
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
      margen_ganancia: {
        orderBy: {
          fecha_aplicacion: "desc",
        },
        take: 1,
      },
    },
  });

  if (!costing) {
    throw new Error("El costeo seleccionado no existe.");
  }

  const latestMargin = costing.margen_ganancia[0];

  if (!latestMargin) {
    throw new Error(
      "Primero debes aplicar un margen de ganancia antes de calcular la rentabilidad.",
    );
  }

  const totalCost = toNumber(costing.costo_total);
  const estimatedIncome = toNumber(
    latestMargin.precio_final ?? latestMargin.precio_sugerido,
  );

  if (totalCost <= 0) {
    throw new Error(
      "No se puede calcular rentabilidad porque el costo total debe ser mayor que cero.",
    );
  }

  if (estimatedIncome <= 0) {
    throw new Error(
      "No se puede calcular rentabilidad porque el ingreso estimado debe ser mayor que cero.",
    );
  }

  const estimatedProfit = estimatedIncome - totalCost;
  const realMargin = (estimatedProfit / totalCost) * 100;
  const expectedMargin = toNumber(latestMargin.porcentaje_margen);
  const lowMarginAlert = realMargin < expectedMargin;

  const lastProfitability = await prisma.rentabilidad.findFirst({
    orderBy: {
      id_rentabilidad: "desc",
    },
    select: {
      id_rentabilidad: true,
    },
  });

  const idRentabilidad = buildNextId(
    "REN",
    lastProfitability?.id_rentabilidad,
  );

  await prisma.$transaction(async (tx) => {
    // Se crea histórico: el modelo permite múltiples cálculos por costeo.
    await tx.rentabilidad.create({
      data: {
        id_rentabilidad: idRentabilidad,
        id_pedido: costing.id_pedido,
        id_costeo: costing.id_costeo,
        ingreso_estimado: estimatedIncome,
        costo_total: totalCost,
        utilidad_estimada: estimatedProfit,
        margen_real: realMargin,
        alerta_bajo_margen: lowMarginAlert,
        observaciones:
          data.observaciones ??
          "Rentabilidad calculada automáticamente usando el último margen aplicado.",
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "rentabilidad",
      id_registro_afectado: idRentabilidad,
      accion: "crear",
      detalle: `Rentabilidad calculada para el costeo ${costing.id_costeo}. Utilidad estimada: S/ ${estimatedProfit.toFixed(2)}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/costs/costings");
  revalidatePath(`/dashboard/costs/costings/${data.id_costeo}`);

  redirect(`/dashboard/costs/costings/${data.id_costeo}`);
}
