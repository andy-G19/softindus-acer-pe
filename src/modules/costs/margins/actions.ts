"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { marginSchema } from "@/schemas/costs/margin.schema";

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

export async function createMarginAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsedData = marginSchema.safeParse({
    id_costeo: formData.get("id_costeo"),
    porcentaje_margen: formData.get("porcentaje_margen"),
    precio_final: formData.get("precio_final"),
    motivo_ajuste: formData.get("motivo_ajuste"),
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
    select: {
      id_costeo: true,
      costo_total: true,
    },
  });

  if (!costing) {
    throw new Error("El costeo seleccionado no existe.");
  }

  const totalCost = toNumber(costing.costo_total);

  if (totalCost <= 0) {
    throw new Error(
      "No se puede aplicar margen porque el costo total debe ser mayor que cero.",
    );
  }

  const suggestedPrice = totalCost * (1 + data.porcentaje_margen / 100);
  const finalPrice = data.precio_final ?? suggestedPrice;

  if (finalPrice < totalCost) {
    throw new Error(
      "El precio final no puede ser menor que el costo total del producto.",
    );
  }

  const lastMargin = await prisma.margen_ganancia.findFirst({
    orderBy: {
      id_margen: "desc",
    },
    select: {
      id_margen: true,
    },
  });

  const idMargen = buildSequentialId(lastMargin?.id_margen, "MGN");

  await prisma.margen_ganancia.create({
    data: {
      id_margen: idMargen,
      id_costeo: data.id_costeo,
      id_usuario_aplica: session.user.id,
      porcentaje_margen: data.porcentaje_margen,
      precio_sugerido: suggestedPrice,
      precio_final: finalPrice,
      motivo_ajuste: data.motivo_ajuste,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "margen_ganancia",
    id_registro_afectado: idMargen,
    accion: "crear",
    detalle: `Margen aplicado al costeo ${data.id_costeo}.`,
  });

  revalidatePath("/dashboard/costs");
  revalidatePath(`/dashboard/costs/costings/${data.id_costeo}`);

  redirect(`/dashboard/costs/costings/${data.id_costeo}`);
}
