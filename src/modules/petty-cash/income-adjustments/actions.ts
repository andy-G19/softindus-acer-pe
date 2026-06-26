"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { pettyCashIncomeAdjustmentSchema } from "@/schemas/petty-cash/petty-cash-income-adjustment.schema";

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

function getMovementConcept(type: string, concept: string) {
  if (type === "ajuste_incremento") {
    return `Ajuste positivo: ${concept}`;
  }

  if (type === "ajuste_disminucion") {
    return `Ajuste negativo: ${concept}`;
  }

  return concept;
}

function getMovementObservation(type: string, observation?: string) {
  if (type === "ajuste_incremento") {
    return observation
      ? `Dirección del ajuste: incremento. ${observation}`
      : "Dirección del ajuste: incremento.";
  }

  if (type === "ajuste_disminucion") {
    return observation
      ? `Dirección del ajuste: disminución. ${observation}`
      : "Dirección del ajuste: disminución.";
  }

  return observation || null;
}

export async function createPettyCashIncomeAdjustmentAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsedData = pettyCashIncomeAdjustmentSchema.safeParse({
    id_caja_chica: formData.get("id_caja_chica"),
    tipo_operacion: formData.get("tipo_operacion"),
    concepto: formData.get("concepto"),
    monto: formData.get("monto"),
    fecha_movimiento: formData.get("fecha_movimiento"),
    comprobante: formData.get("comprobante"),
    responsable: formData.get("responsable"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsedData.success) {
    const message = parsedData.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsedData.data;

  const cashBox = await prisma.caja_chica.findUnique({
    where: {
      id_caja_chica: data.id_caja_chica,
    },
    select: {
      id_caja_chica: true,
      nombre_caja: true,
      saldo_actual: true,
      estado: true,
    },
  });

  if (!cashBox) {
    throw new Error("La caja chica seleccionada no existe.");
  }

  if (cashBox.estado !== "abierta") {
    throw new Error("Solo se pueden registrar movimientos en cajas abiertas.");
  }

  const currentBalance = toNumber(cashBox.saldo_actual);
  const isNegativeAdjustment = data.tipo_operacion === "ajuste_disminucion";

  if (isNegativeAdjustment && data.monto > currentBalance) {
    throw new Error(
      `El ajuste negativo supera el saldo disponible de la caja. Saldo actual: S/ ${currentBalance.toFixed(
        2,
      )}.`,
    );
  }

  const lastMovement = await prisma.movimiento_caja.findFirst({
    orderBy: {
      id_movimiento_caja: "desc",
    },
    select: {
      id_movimiento_caja: true,
    },
  });

  const idMovimientoCaja = buildSequentialId(
    lastMovement?.id_movimiento_caja,
    "MCA",
  );

  const movementType =
    data.tipo_operacion === "ingreso" ? "ingreso" : "ajuste";

  const movementConcept = getMovementConcept(
    data.tipo_operacion,
    data.concepto,
  );

  const movementObservation = getMovementObservation(
    data.tipo_operacion,
    data.observaciones,
  );

  await prisma.$transaction(async (tx) => {
    await tx.movimiento_caja.create({
      data: {
        id_movimiento_caja: idMovimientoCaja,
        id_caja_chica: data.id_caja_chica,
        id_usuario_registro: session.user.id,
        tipo_movimiento: movementType,
        concepto: movementConcept,
        monto: data.monto,
        fecha_movimiento: data.fecha_movimiento,
        comprobante: data.comprobante || null,
        responsable:
          data.responsable || session.user.name || "Administrador",
        observaciones: movementObservation,
      },
    });

    await tx.caja_chica.update({
      where: {
        id_caja_chica: data.id_caja_chica,
      },
      data: {
        saldo_actual: isNegativeAdjustment
          ? {
              decrement: data.monto,
            }
          : {
              increment: data.monto,
            },
      },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/boxes");
  revalidatePath("/dashboard/petty-cash/income-adjustments/new");
  revalidatePath("/dashboard/petty-cash/movements");
  revalidatePath("/dashboard/petty-cash/monthly-summary");

  redirect("/dashboard/petty-cash");
}