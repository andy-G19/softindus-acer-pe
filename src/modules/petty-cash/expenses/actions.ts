"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { lockCashBoxRow } from "@/lib/row-locks";
import { checkCashWithdrawal } from "@/lib/petty-cash-amounts";
import { pettyCashExpenseSchema } from "@/schemas/petty-cash/petty-cash-expense.schema";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

export async function createPettyCashExpenseAction(formData: FormData) {
  const session = await requireAdmin();

  const parsedData = pettyCashExpenseSchema.safeParse({
    id_caja_chica: formData.get("id_caja_chica"),
    id_categoria_gasto: formData.get("id_categoria_gasto"),
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

  await prisma.$transaction(async (tx) => {
    // C3 de la 11.4a (D44): la caja se bloquea antes de leerla, y la caja y la categoria se leen
    // con tx. Dos egresos simultaneos leian el saldo fuera de la transaccion, los dos lo veian
    // suficiente y la caja quedaba en negativo: ahora el segundo espera al primero y ve el saldo
    // ya descontado. Un rechazo lanza dentro de la transaccion, que no escribio nada.
    await lockCashBoxRow(tx, data.id_caja_chica);

    const cashBox = await tx.caja_chica.findUnique({
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
      throw new Error("Solo se pueden registrar egresos en cajas abiertas.");
    }

    // C2 de la 11.4a (D43): el monto redondeado como la columna, comparado en centesimos con el
    // saldo guardado; es el mismo que se guarda en el movimiento y se descuenta de la caja.
    const withdrawal = checkCashWithdrawal({ balance: cashBox.saldo_actual, amount: data.monto });

    if (!withdrawal.accepted) {
      throw new Error(
        `El egreso supera el saldo disponible de la caja. Saldo actual: S/ ${withdrawal.balance}.`,
      );
    }

    const category = await tx.categoria_gasto.findUnique({
      where: {
        id_categoria_gasto: data.id_categoria_gasto,
      },
      select: {
        id_categoria_gasto: true,
        nombre_categoria: true,
        estado: true,
      },
    });

    if (!category) {
      throw new Error("La categoría seleccionada no existe.");
    }

    if (!category.estado) {
      throw new Error("No se puede usar una categoría de gasto inactiva.");
    }

    const idMovimientoCaja = await getNextCorrelativeId(tx, {
      codigoEntidad: "movimiento_caja",
      prefijo: "MCA",
    });

    await tx.movimiento_caja.create({
      data: {
        id_movimiento_caja: idMovimientoCaja,
        id_caja_chica: data.id_caja_chica,
        id_categoria_gasto: data.id_categoria_gasto,
        id_usuario_registro: session.user.id,
        tipo_movimiento: "egreso",
        concepto: data.concepto,
        monto: withdrawal.amount,
        fecha_movimiento: data.fecha_movimiento,
        comprobante: data.comprobante || null,
        responsable:
          data.responsable || session.user.name || "Administrador",
        observaciones: data.observaciones || null,
      },
    });

    await tx.caja_chica.update({
      where: {
        id_caja_chica: data.id_caja_chica,
      },
      data: {
        saldo_actual: {
          decrement: withdrawal.amount,
        },
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "movimiento_caja",
      id_registro_afectado: idMovimientoCaja,
      accion: "crear",
      detalle: `Egreso de caja registrado: ${data.concepto}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/boxes");
  revalidatePath("/dashboard/petty-cash/expenses/new");
  revalidatePath("/dashboard/petty-cash/movements");
  revalidatePath("/dashboard/petty-cash/monthly-summary");

  redirect("/dashboard/petty-cash?toast=petty-cash-expense-registered");
}
