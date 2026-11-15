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
import { checkPayrollPayment } from "@/lib/payroll-amounts";
import { APP_ROLES } from "@/lib/permissions";
import { lockPayrollRow } from "@/lib/row-locks";
import { operationKeySchema } from "@/schemas/operation-key.schema";
import { operatorPaymentSchema } from "@/schemas/staff/operator-payment.schema";

function formatPeriodDate(value: Date) {
  return value.toISOString().split("T")[0];
}

/** Lo que el formulario del pago envio, para volver a mostrarlo. */
export type OperatorPaymentFormValues = {
  id_planilla: string;
  fecha_pago: string;
  monto_pagado: string;
  metodo_pago: string;
  observaciones: string;
};

// C7 de la 11.5 (D59): el pago devuelve el resultado y el formulario da el aviso y vuelve al
// historial, como generar planilla (C6). Un error queda en el formulario, junto a su campo, en
// lugar de la pagina de error; sin permiso responde con un error. El exito lleva la clave
// confirmada para que el formulario genere otra (OperationKeyField).
export type OperatorPaymentFormState = FormActionState<
  OperatorPaymentFormValues,
  { id_historial_pago: string; clave_operacion: string }
>;

const PAY_OPERATION = "pagar_planilla";

const paymentFormSchema = operatorPaymentSchema.and(z.object({ clave_operacion: operationKeySchema }));

/**
 * Un rechazo que se decide dentro de la transaccion, despues de reclamar la clave: se lanza para
 * que la transaccion se revierta y libere la clave, y la accion lo convierte en el error de su
 * campo.
 */
class OperatorPaymentValidationError extends Error {
  constructor(
    readonly field: keyof OperatorPaymentFormValues,
    message: string,
  ) {
    super(message);
  }
}

function getOperatorPaymentFormValues(formData: FormData): OperatorPaymentFormValues {
  const text = (name: keyof OperatorPaymentFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_planilla: text("id_planilla"),
    fecha_pago: text("fecha_pago"),
    monto_pagado: text("monto_pagado"),
    metodo_pago: text("metodo_pago"),
    observaciones: text("observaciones"),
  };
}

export async function registerOperatorPaymentAction(
  _prevState: OperatorPaymentFormState,
  formData: FormData,
): Promise<OperatorPaymentFormState> {
  const values = getOperatorPaymentFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): OperatorPaymentFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail("No tienes permisos para registrar pagos de planilla.");
  }

  const parsed = paymentFormSchema.safeParse({
    ...values,
    clave_operacion: formData.get("clave_operacion"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La clave va en un campo oculto: su mensaje es el general, no el de un campo.
    const keyError = fieldErrors.clave_operacion?.[0];

    return fail(keyError ?? "Revisa los datos del pago.", fieldErrors);
  }

  const data = parsed.data;

  let idHistorialPago: string;

  try {
    idHistorialPago = await prisma.$transaction(async (tx) => {
      // C7 de la 11.5: la clave se reclama como primera sentencia, antes del candado y del
      // correlativo. Un reenvio con la misma clave responde con el pago ya registrado sin crear
      // otro; un rechazo posterior lanza y libera la clave.
      const claim = await claimOperation(tx, {
        clave: data.clave_operacion,
        tipo: PAY_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene un pago registrado.");
        }

        return claim.idRegistro;
      }

      // C4 de la 11.5 (D54): la planilla se bloquea antes de leerla y se decide dentro de la
      // transaccion. Dos pagos simultaneos de la misma planilla: el segundo espera al primero y
      // la ve pagada; un pago y una anulacion a la vez tampoco se cruzan.
      await lockPayrollRow(tx, data.id_planilla);

      const payroll = await tx.planilla_pago.findUnique({
        where: {
          id_planilla: data.id_planilla,
        },
        include: {
          operario: true,
          historial_pago_operario: true,
        },
      });

      if (!payroll) {
        throw new OperatorPaymentValidationError("id_planilla", "La planilla seleccionada no existe.");
      }

      if (payroll.estado_pago === "anulada") {
        throw new OperatorPaymentValidationError("id_planilla", "No se puede pagar una planilla anulada.");
      }

      if (payroll.estado_pago === "pagado") {
        throw new OperatorPaymentValidationError("id_planilla", "La planilla seleccionada ya fue pagada.");
      }

      if (payroll.historial_pago_operario.length > 0) {
        throw new OperatorPaymentValidationError(
          "id_planilla",
          "Esta planilla ya tiene un pago registrado en el historial.",
        );
      }

      // C2 de la 11.5 (D53): el pago, redondeado como su columna, debe ser exactamente el neto en
      // centesimos; la tolerancia de 0.01 en number dependia del error de coma flotante.
      const payment = checkPayrollPayment({ net: payroll.monto_neto, amount: data.monto_pagado });

      if (!payment.accepted) {
        throw new OperatorPaymentValidationError(
          "monto_pagado",
          "Para esta versión MVP, el monto pagado debe coincidir con el monto neto de la planilla.",
        );
      }

      const periodo = `${formatPeriodDate(payroll.periodo_inicio)} a ${formatPeriodDate(
        payroll.periodo_fin,
      )}`;

      const idNuevoPago = await getNextCorrelativeId(tx, {
        codigoEntidad: "historial_pago_operario",
        prefijo: "HPO",
      });

      await tx.historial_pago_operario.create({
        data: {
          id_historial_pago: idNuevoPago,
          id_planilla: payroll.id_planilla,
          id_operario: payroll.id_operario,
          id_usuario_registro: session.user.id,
          fecha_pago: data.fecha_pago,
          monto_pagado: payment.amount,
          metodo_pago: data.metodo_pago,
          periodo,
          observaciones: data.observaciones || null,
        },
      });

      await tx.planilla_pago.update({
        where: {
          id_planilla: payroll.id_planilla,
        },
        data: {
          estado_pago: "pagado",
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "historial_pago_operario",
        id_registro_afectado: idNuevoPago,
        accion: "crear",
        detalle: `Pago registrado para la planilla ${payroll.id_planilla}.`,
        tx,
      });

      await completeOperation(tx, { clave: data.clave_operacion, idRegistro: idNuevoPago });

      return idNuevoPago;
    });
  } catch (error) {
    if (error instanceof OperatorPaymentValidationError) {
      return fail(error.message, { [error.field]: [error.message] });
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/payrolls");
  revalidatePath("/dashboard/staff/payment-history");

  return {
    status: "success",
    data: { id_historial_pago: idHistorialPago, clave_operacion: data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
}
