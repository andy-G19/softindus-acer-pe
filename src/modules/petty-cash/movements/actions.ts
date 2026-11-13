"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { lockCashBoxRow, lockCashMovementRow } from "@/lib/row-locks";
import { toNumber } from "@/lib/numbers";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

function normalizeText(value: FormDataEntryValue | null) {
  return value ? String(value).trim() : "";
}

function isNegativeMovement(type: string, concept: string) {
  return type === "egreso" || concept.startsWith("Ajuste negativo");
}

export async function annulPettyCashMovementAction(formData: FormData) {
  const session = await requireAdmin();

  const idMovimientoCaja = normalizeText(formData.get("id_movimiento_caja"));

  if (!idMovimientoCaja) {
    throw new Error("Debe seleccionar un movimiento de caja valido.");
  }

  await prisma.$transaction(async (tx) => {
    // C3 de la 11.4a (D44): el movimiento se bloquea antes de leerlo y despues su caja antes de
    // leer el saldo; el movimiento primero y la caja al final. Dos anulaciones simultaneas leian
    // la marca [ANULADO] sin bloquear: las dos la veian ausente y las dos devolvian el monto.
    // Ahora la segunda espera a la primera y ve la marca.
    await lockCashMovementRow(tx, idMovimientoCaja);

    const movement = await tx.movimiento_caja.findUnique({
      where: {
        id_movimiento_caja: idMovimientoCaja,
      },
      select: {
        id_movimiento_caja: true,
        id_caja_chica: true,
        tipo_movimiento: true,
        concepto: true,
        monto: true,
        observaciones: true,
      },
    });

    if (!movement) {
      throw new Error("El movimiento de caja seleccionado no existe.");
    }

    if (movement.observaciones?.includes("[ANULADO]")) {
      throw new Error("No se puede anular un movimiento ya anulado.");
    }

    await lockCashBoxRow(tx, movement.id_caja_chica);

    const cashBox = await tx.caja_chica.findUnique({
      where: {
        id_caja_chica: movement.id_caja_chica,
      },
      select: {
        saldo_actual: true,
        estado: true,
      },
    });

    if (!cashBox || cashBox.estado !== "abierta") {
      throw new Error("Solo se pueden anular movimientos de cajas abiertas.");
    }

    const amount = toNumber(movement.monto);
    const wasNegativeMovement = isNegativeMovement(
      movement.tipo_movimiento,
      movement.concepto,
    );

    if (!wasNegativeMovement && toNumber(cashBox.saldo_actual) < amount) {
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
