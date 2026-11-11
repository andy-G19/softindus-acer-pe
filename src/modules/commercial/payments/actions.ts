"use server";

import { revalidatePath } from "next/cache";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { calculateClientPayment, hasCents } from "@/lib/client-payment-amounts";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { claimOperation, completeOperation, IdempotencyConflictError } from "@/lib/idempotency";
import { APP_ROLES } from "@/lib/permissions";
import { lockQuoteRow } from "@/lib/row-locks";
import { paymentSchema } from "@/schemas/commercial/payment.schema";
import { operationKeySchema } from "@/schemas/operation-key.schema";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();

  return text ? text : null;
}

/** Lo que el formulario de pago envio, para volver a mostrarlo. */
export type PaymentFormValues = {
  monto_pagado: string;
  metodo_pago: string;
  tipo_pago: string;
  observaciones: string;
};

// C5 de la 11.3a (D27): el pago de cliente devuelve el resultado y su seccion del detalle de la
// proforma da el aviso, como el pago a proveedor (11.2a). Sin permiso responde con un error en
// la seccion; un rechazo ya no lleva a la pagina de error. El exito lleva la clave confirmada
// para que el formulario genere otra (OperationKeyField).
export type PaymentFormState = FormActionState<
  PaymentFormValues,
  { id_pago_cliente: string; clave_operacion: string }
>;

const PAYMENT_OPERATION = "registrar_pago_cliente";

const paymentFormSchema = paymentSchema.extend({ clave_operacion: operationKeySchema });

/**
 * Un rechazo que se decide dentro de la transaccion, despues de reclamar la clave: se lanza para
 * que la transaccion se revierta y libere la clave (CLAUDE.md, Idempotent operations), y la
 * accion lo convierte en el error de la seccion o de su campo.
 */
class PaymentValidationError extends Error {
  constructor(
    message: string,
    readonly field?: keyof PaymentFormValues,
  ) {
    super(message);
  }
}

function getPaymentFormValues(formData: FormData): PaymentFormValues {
  const text = (name: keyof PaymentFormValues) => formData.get(name)?.toString() ?? "";

  return {
    monto_pagado: text("monto_pagado"),
    metodo_pago: text("metodo_pago"),
    tipo_pago: text("tipo_pago"),
    observaciones: text("observaciones"),
  };
}

export async function createPaymentAction(
  _prevState: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const values = getPaymentFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): PaymentFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.SELLER]);

  if (!session) {
    return fail("No tienes permisos para registrar pagos de clientes.");
  }

  const parsed = paymentFormSchema.safeParse({
    id_proforma: formData.get("id_proforma")?.toString(),
    monto_pagado: formData.get("monto_pagado"),
    metodo_pago: formData.get("metodo_pago")?.toString(),
    tipo_pago: formData.get("tipo_pago")?.toString(),
    observaciones: formData.get("observaciones")?.toString() ?? "",
    clave_operacion: formData.get("clave_operacion"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La proforma y la clave van en campos ocultos: su mensaje es el general, no el de un campo.
    const hiddenError = fieldErrors.clave_operacion?.[0] ?? fieldErrors.id_proforma?.[0];

    return fail(hiddenError ?? "Revisa los datos del pago.", fieldErrors);
  }

  const { id_proforma, monto_pagado, metodo_pago, tipo_pago, clave_operacion } = parsed.data;
  let idPagoCliente: string;

  try {
    idPagoCliente = await prisma.$transaction(async (tx) => {
      // C5 de la 11.3a: la clave se reclama como primera sentencia, antes del bloqueo y del
      // correlativo. Un reenvio con la misma clave responde con el pago ya guardado sin
      // descontar el saldo otra vez; un rechazo posterior lanza y libera la clave.
      const claim = await claimOperation(tx, {
        clave: clave_operacion,
        tipo: PAYMENT_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene un pago registrado.");
        }

        return claim.idRegistro;
      }

      // C3 de la 11.3a (hallazgo 5): la proforma se bloquea antes de leer su saldo y su estado,
      // asi dos pagos o un pago y una anulacion simultaneos van en fila.
      await lockQuoteRow(tx, id_proforma);

      const quote = await tx.proforma.findUnique({
        where: {
          id_proforma,
        },
        select: {
          id_proforma: true,
          id_pedido: true,
          saldo: true,
          estado: true,
        },
      });

      if (!quote) {
        throw new PaymentValidationError("La proforma seleccionada no existe.");
      }

      if (quote.estado === "anulada") {
        throw new PaymentValidationError("No se puede registrar pagos en una proforma anulada.");
      }

      if (quote.estado === "pagada" || !hasCents(quote.saldo)) {
        throw new PaymentValidationError("La proforma ya se encuentra pagada.");
      }

      // C2 de la 11.3a: el monto se redondea como la columna antes de compararlo con el saldo
      // guardado y de restarlo, en centimos (client-payment-amounts.ts).
      const payment = calculateClientPayment({ balance: quote.saldo, amount: monto_pagado });

      if (!payment.accepted) {
        throw new PaymentValidationError(
          `El pago no puede ser mayor que el saldo pendiente: S/ ${payment.balance}.`,
          "monto_pagado",
        );
      }

      const id_pago_cliente = await getNextCorrelativeId(tx, {
        codigoEntidad: "pago_cliente",
        prefijo: "PCL",
      });

      await tx.pago_cliente.create({
        data: {
          id_pago_cliente,
          id_proforma: quote.id_proforma,
          id_pedido: quote.id_pedido,
          id_usuario_registro: session.user.id,
          fecha_pago: new Date(),
          monto_pagado: payment.amount,
          metodo_pago,
          tipo_pago,
          saldo_actual: payment.newBalance,
          observaciones: emptyToNull(formData.get("observaciones")),
        },
      });

      await tx.proforma.update({
        where: {
          id_proforma: quote.id_proforma,
        },
        data: {
          saldo: payment.newBalance,
          estado: payment.status,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "pago_cliente",
        id_registro_afectado: id_pago_cliente,
        accion: "crear",
        detalle: `Pago de cliente registrado para la proforma ${quote.id_proforma}.`,
        tx,
      });

      await completeOperation(tx, { clave: clave_operacion, idRegistro: id_pago_cliente });

      return id_pago_cliente;
    });
  } catch (error) {
    if (error instanceof PaymentValidationError) {
      return fail(error.message, error.field ? { [error.field]: [error.message] } : undefined);
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard/commercial/quotes");
  revalidatePath(`/dashboard/commercial/quotes/${id_proforma}`);
  revalidatePath("/dashboard/commercial/orders");

  return {
    status: "success",
    data: { id_pago_cliente: idPagoCliente, clave_operacion },
    values,
    operationId: newOperationId(),
  };
}
