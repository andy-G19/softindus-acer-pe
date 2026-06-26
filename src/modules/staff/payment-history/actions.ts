"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { operatorPaymentSchema } from "@/schemas/staff/operator-payment.schema";

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

function formatPeriodDate(value: Date) {
  return value.toISOString().split("T")[0];
}

export async function registerOperatorPaymentAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = operatorPaymentSchema.safeParse({
    id_planilla: formData.get("id_planilla"),
    fecha_pago: formData.get("fecha_pago"),
    monto_pagado: formData.get("monto_pagado"),
    metodo_pago: formData.get("metodo_pago"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const payroll = await prisma.planilla_pago.findUnique({
    where: {
      id_planilla: data.id_planilla,
    },
    include: {
      operario: true,
      historial_pago_operario: true,
    },
  });

  if (!payroll) {
    throw new Error("La planilla seleccionada no existe.");
  }

  if (payroll.estado_pago === "anulada") {
    throw new Error("No se puede pagar una planilla anulada.");
  }

  if (payroll.estado_pago === "pagado") {
    throw new Error("La planilla seleccionada ya fue pagada.");
  }

  if (payroll.historial_pago_operario.length > 0) {
    throw new Error(
      "Esta planilla ya tiene un pago registrado en el historial.",
    );
  }

  const netAmount = toNumber(payroll.monto_neto);

  if (Math.abs(data.monto_pagado - netAmount) > 0.01) {
    throw new Error(
      "Para esta versión MVP, el monto pagado debe coincidir con el monto neto de la planilla.",
    );
  }

  const lastPayment = await prisma.historial_pago_operario.findFirst({
    orderBy: {
      id_historial_pago: "desc",
    },
    select: {
      id_historial_pago: true,
    },
  });

  const idHistorialPago = buildSequentialId(
    lastPayment?.id_historial_pago,
    "HPO",
  );

  const periodo = `${formatPeriodDate(payroll.periodo_inicio)} a ${formatPeriodDate(
    payroll.periodo_fin,
  )}`;

  await prisma.$transaction([
    prisma.historial_pago_operario.create({
      data: {
        id_historial_pago: idHistorialPago,
        id_planilla: payroll.id_planilla,
        id_operario: payroll.id_operario,
        id_usuario_registro: session.user.id,
        fecha_pago: data.fecha_pago,
        monto_pagado: data.monto_pagado.toFixed(2),
        metodo_pago: data.metodo_pago,
        periodo,
        observaciones: data.observaciones || null,
      },
    }),

    prisma.planilla_pago.update({
      where: {
        id_planilla: payroll.id_planilla,
      },
      data: {
        estado_pago: "pagado",
      },
    }),
  ]);

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/payrolls");
  revalidatePath("/dashboard/staff/payment-history");

  redirect("/dashboard/staff/payment-history");
}