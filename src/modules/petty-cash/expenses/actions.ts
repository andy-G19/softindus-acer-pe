"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { claimOperation, completeOperation, IdempotencyConflictError } from "@/lib/idempotency";
import { APP_ROLES } from "@/lib/permissions";
import { checkCashWithdrawal } from "@/lib/petty-cash-amounts";
import { lockCashBoxRow } from "@/lib/row-locks";
import { operationKeySchema } from "@/schemas/operation-key.schema";
import { pettyCashExpenseSchema } from "@/schemas/petty-cash/petty-cash-expense.schema";

/** Lo que el formulario del egreso envio, para volver a mostrarlo. */
export type PettyCashExpenseFormValues = {
  id_caja_chica: string;
  id_categoria_gasto: string;
  concepto: string;
  monto: string;
  fecha_movimiento: string;
  comprobante: string;
  responsable: string;
  observaciones: string;
};

// C5 de la 11.4a (D46): el egreso devuelve el resultado y el formulario da el aviso y vuelve al
// inicio de caja chica, como crear compra. Un error queda en el formulario, junto a su campo, en
// lugar de la pagina de error; sin permiso responde con un error. El exito lleva la clave
// confirmada para que el formulario genere otra (OperationKeyField).
export type PettyCashExpenseFormState = FormActionState<
  PettyCashExpenseFormValues,
  { id_movimiento_caja: string; clave_operacion: string }
>;

const EXPENSE_OPERATION = "registrar_egreso_caja";

const expenseFormSchema = pettyCashExpenseSchema.and(z.object({ clave_operacion: operationKeySchema }));

/**
 * Un rechazo que se decide dentro de la transaccion, despues de reclamar la clave: se lanza para
 * que la transaccion se revierta y libere la clave (CLAUDE.md, Idempotent operations), y la
 * accion lo convierte en el error de su campo.
 */
class ExpenseValidationError extends Error {
  constructor(
    readonly field: keyof PettyCashExpenseFormValues,
    message: string,
  ) {
    super(message);
  }
}

function getExpenseFormValues(formData: FormData): PettyCashExpenseFormValues {
  const text = (name: keyof PettyCashExpenseFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_caja_chica: text("id_caja_chica"),
    id_categoria_gasto: text("id_categoria_gasto"),
    concepto: text("concepto"),
    monto: text("monto"),
    fecha_movimiento: text("fecha_movimiento"),
    comprobante: text("comprobante"),
    responsable: text("responsable"),
    observaciones: text("observaciones"),
  };
}

export async function createPettyCashExpenseAction(
  _prevState: PettyCashExpenseFormState,
  formData: FormData,
): Promise<PettyCashExpenseFormState> {
  const values = getExpenseFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): PettyCashExpenseFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail("No tienes permisos para registrar egresos de caja chica.");
  }

  const parsed = expenseFormSchema.safeParse({
    id_caja_chica: values.id_caja_chica,
    id_categoria_gasto: values.id_categoria_gasto,
    concepto: values.concepto,
    monto: values.monto,
    fecha_movimiento: values.fecha_movimiento,
    comprobante: values.comprobante,
    responsable: values.responsable,
    observaciones: values.observaciones,
    clave_operacion: formData.get("clave_operacion"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La clave va en un campo oculto: su mensaje es el general, no el de un campo.
    const keyError = fieldErrors.clave_operacion?.[0];

    return fail(keyError ?? "Revisa los datos del egreso.", fieldErrors);
  }

  const data = parsed.data;
  let idMovimientoCaja: string;

  try {
    idMovimientoCaja = await prisma.$transaction(async (tx) => {
      // C5 de la 11.4a: la clave se reclama como primera sentencia, antes del bloqueo y del
      // correlativo. Un reenvio con la misma clave responde con el egreso ya guardado sin crear
      // otro ni descontar dos veces; un rechazo posterior lanza y libera la clave.
      const claim = await claimOperation(tx, {
        clave: data.clave_operacion,
        tipo: EXPENSE_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene un egreso registrado.");
        }

        return claim.idRegistro;
      }

      // C3 de la 11.4a (D44): la caja se bloquea antes de leerla, y la caja y la categoria se leen
      // con tx. Dos egresos simultaneos leian el saldo fuera de la transaccion, los dos lo veian
      // suficiente y la caja quedaba en negativo: ahora el segundo espera al primero y ve el saldo
      // ya descontado.
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
        throw new ExpenseValidationError("id_caja_chica", "La caja chica seleccionada no existe.");
      }

      if (cashBox.estado !== "abierta") {
        throw new ExpenseValidationError("id_caja_chica", "Solo se pueden registrar egresos en cajas abiertas.");
      }

      // C2 de la 11.4a (D43): el monto redondeado como la columna, comparado en centesimos con el
      // saldo guardado; es el mismo que se guarda en el movimiento y se descuenta de la caja.
      const withdrawal = checkCashWithdrawal({ balance: cashBox.saldo_actual, amount: data.monto });

      if (!withdrawal.accepted) {
        throw new ExpenseValidationError(
          "monto",
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
        throw new ExpenseValidationError("id_categoria_gasto", "La categoría seleccionada no existe.");
      }

      if (!category.estado) {
        throw new ExpenseValidationError("id_categoria_gasto", "No se puede usar una categoría de gasto inactiva.");
      }

      const idMovimiento = await getNextCorrelativeId(tx, {
        codigoEntidad: "movimiento_caja",
        prefijo: "MCA",
      });

      await tx.movimiento_caja.create({
        data: {
          id_movimiento_caja: idMovimiento,
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
        id_registro_afectado: idMovimiento,
        accion: "crear",
        detalle: `Egreso de caja registrado: ${data.concepto}.`,
        tx,
      });

      await completeOperation(tx, { clave: data.clave_operacion, idRegistro: idMovimiento });

      return idMovimiento;
    });
  } catch (error) {
    if (error instanceof ExpenseValidationError) {
      return fail(error.message, { [error.field]: [error.message] });
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/boxes");
  revalidatePath("/dashboard/petty-cash/expenses/new");
  revalidatePath("/dashboard/petty-cash/movements");
  revalidatePath("/dashboard/petty-cash/monthly-summary");

  return {
    status: "success",
    data: { id_movimiento_caja: idMovimientoCaja, clave_operacion: data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
}
