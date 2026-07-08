"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
}

function normalizeText(value: FormDataEntryValue | null) {
  return value ? String(value).trim() : "";
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function isNegativeMovement(type: string, concept: string) {
  return type === "egreso" || concept.startsWith("Ajuste negativo");
}

export async function annulPettyCashMovementAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const idMovimientoCaja = normalizeText(formData.get("id_movimiento_caja"));

  if (!idMovimientoCaja) {
    throw new Error("Debe seleccionar un movimiento de caja valido.");
  }

  await prisma.$transaction(async (tx) => {
    const movement = await tx.movimiento_caja.findUnique({
      where: {
        id_movimiento_caja: idMovimientoCaja,
      },
      include: {
        caja_chica: true,
      },
    });

    if (!movement) {
      throw new Error("El movimiento de caja seleccionado no existe.");
    }

    if (movement.observaciones?.includes("[ANULADO]")) {
      throw new Error("No se puede anular un movimiento ya anulado.");
    }

    if (movement.caja_chica.estado !== "abierta") {
      throw new Error("Solo se pueden anular movimientos de cajas abiertas.");
    }

    const amount = toNumber(movement.monto);
    const wasNegativeMovement = isNegativeMovement(
      movement.tipo_movimiento,
      movement.concepto,
    );

    if (!wasNegativeMovement && toNumber(movement.caja_chica.saldo_actual) < amount) {
      throw new Error(
        "No se puede anular el ingreso porque la caja no tiene saldo suficiente para revertirlo.",
      );
    }

    const revertBalance = wasNegativeMovement
      ? { increment: amount }
      : { decrement: amount };

    await tx.movimiento_caja.update({
      where: {
        id_movimiento_caja: idMovimientoCaja,
      },
      data: {
        monto: 0,
        observaciones: [
          movement.observaciones,
          `[ANULADO] ${new Date().toISOString()} - Monto original: S/ ${amount.toFixed(
            2,
          )}.`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });

    await tx.caja_chica.update({
      where: {
        id_caja_chica: movement.id_caja_chica,
      },
      data: {
        saldo_actual: revertBalance,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "movimiento_caja",
      id_registro_afectado: idMovimientoCaja,
      accion: "anular",
      detalle: `Movimiento de caja anulado: ${movement.concepto}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/movements");
  revalidatePath("/dashboard/petty-cash/monthly-summary");
  revalidatePath("/dashboard/petty-cash/boxes");

  redirect("/dashboard/petty-cash/movements?toast=petty-cash-movement-annulled");
}
