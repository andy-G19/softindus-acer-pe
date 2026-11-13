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
import { checkCashWithdrawal, roundCashAmount } from "@/lib/petty-cash-amounts";
import { lockCashBoxRow } from "@/lib/row-locks";
import { operationKeySchema } from "@/schemas/operation-key.schema";
import { pettyCashIncomeAdjustmentSchema } from "@/schemas/petty-cash/petty-cash-income-adjustment.schema";

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

/** Lo que el formulario del ingreso o ajuste envio, para volver a mostrarlo. */
export type PettyCashIncomeAdjustmentFormValues = {
  id_caja_chica: string;
  tipo_operacion: string;
  concepto: string;
  monto: string;
  fecha_movimiento: string;
  comprobante: string;
  responsable: string;
  observaciones: string;
};

// C6 de la 11.4a (D46): el ingreso o ajuste devuelve el resultado y el formulario da el aviso y
// vuelve al inicio de caja chica, como el egreso (C5). Un error queda en el formulario, junto a
// su campo; sin permiso responde con un error. El exito lleva la clave confirmada para que el
// formulario genere otra (OperationKeyField).
export type PettyCashIncomeAdjustmentFormState = FormActionState<
  PettyCashIncomeAdjustmentFormValues,
  { id_movimiento_caja: string; clave_operacion: string }
>;

const INCOME_OPERATION = "registrar_ingreso_caja";

const incomeFormSchema = pettyCashIncomeAdjustmentSchema.and(z.object({ clave_operacion: operationKeySchema }));

/**
 * Un rechazo que se decide dentro de la transaccion, despues de reclamar la clave: se lanza para
 * que la transaccion se revierta y libere la clave, y la accion lo convierte en el error de su
 * campo.
 */
class IncomeAdjustmentValidationError extends Error {
  constructor(
    readonly field: keyof PettyCashIncomeAdjustmentFormValues,
    message: string,
  ) {
    super(message);
  }
}

function getIncomeAdjustmentFormValues(formData: FormData): PettyCashIncomeAdjustmentFormValues {
  const text = (name: keyof PettyCashIncomeAdjustmentFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_caja_chica: text("id_caja_chica"),
    tipo_operacion: text("tipo_operacion"),
    concepto: text("concepto"),
    monto: text("monto"),
    fecha_movimiento: text("fecha_movimiento"),
    comprobante: text("comprobante"),
    responsable: text("responsable"),
    observaciones: text("observaciones"),
  };
}

export async function createPettyCashIncomeAdjustmentAction(
  _prevState: PettyCashIncomeAdjustmentFormState,
  formData: FormData,
): Promise<PettyCashIncomeAdjustmentFormState> {
  const values = getIncomeAdjustmentFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): PettyCashIncomeAdjustmentFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail("No tienes permisos para registrar ingresos o ajustes de caja chica.");
  }

  const parsed = incomeFormSchema.safeParse({
    id_caja_chica: values.id_caja_chica,
    tipo_operacion: values.tipo_operacion,
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

    return fail(keyError ?? "Revisa los datos del movimiento.", fieldErrors);
  }

  const data = parsed.data;

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

  let idMovimientoCaja: string;

  try {
    idMovimientoCaja = await prisma.$transaction(async (tx) => {
      // C6 de la 11.4a: la clave se reclama como primera sentencia, antes del bloqueo y del
      // correlativo. Un reenvio con la misma clave responde con el movimiento ya guardado sin
      // crear otro ni mover el saldo dos veces; un rechazo posterior lanza y libera la clave.
      const claim = await claimOperation(tx, {
        clave: data.clave_operacion,
        tipo: INCOME_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene un movimiento registrado.");
        }

        return claim.idRegistro;
      }

      // C3 de la 11.4a (D44): la caja se bloquea antes de leerla y se lee con tx, como en el
      // egreso: un ajuste negativo simultaneo con un egreso podia dejarla en negativo.
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
        throw new IncomeAdjustmentValidationError("id_caja_chica", "La caja chica seleccionada no existe.");
      }

      if (cashBox.estado !== "abierta") {
        throw new IncomeAdjustmentValidationError("id_caja_chica", "Solo se pueden registrar movimientos en cajas abiertas.");
      }

      const isNegativeAdjustment = data.tipo_operacion === "ajuste_disminucion";

      // C2 de la 11.4a (D43): el monto redondeado como la columna; un ajuste negativo se compara
      // en centesimos con el saldo guardado. Es el mismo monto que se guarda y que mueve el saldo.
      let amount = roundCashAmount(data.monto);

      if (isNegativeAdjustment) {
        const withdrawal = checkCashWithdrawal({ balance: cashBox.saldo_actual, amount: data.monto });

        if (!withdrawal.accepted) {
          throw new IncomeAdjustmentValidationError(
            "monto",
            `El ajuste negativo supera el saldo disponible de la caja. Saldo actual: S/ ${withdrawal.balance}.`,
          );
        }

        amount = withdrawal.amount;
      }

      const idMovimiento = await getNextCorrelativeId(tx, {
        codigoEntidad: "movimiento_caja",
        prefijo: "MCA",
      });

      await tx.movimiento_caja.create({
        data: {
          id_movimiento_caja: idMovimiento,
          id_caja_chica: data.id_caja_chica,
          id_usuario_registro: session.user.id,
          tipo_movimiento: movementType,
          concepto: movementConcept,
          monto: amount,
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
                decrement: amount,
              }
            : {
                increment: amount,
              },
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "movimiento_caja",
        id_registro_afectado: idMovimiento,
        accion: "crear",
        detalle: `Movimiento de caja registrado: ${movementConcept}.`,
        tx,
      });

      await completeOperation(tx, { clave: data.clave_operacion, idRegistro: idMovimiento });

      return idMovimiento;
    });
  } catch (error) {
    if (error instanceof IncomeAdjustmentValidationError) {
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
  revalidatePath("/dashboard/petty-cash/income-adjustments/new");
  revalidatePath("/dashboard/petty-cash/movements");
  revalidatePath("/dashboard/petty-cash/monthly-summary");

  return {
    status: "success",
    data: { id_movimiento_caja: idMovimientoCaja, clave_operacion: data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
}
