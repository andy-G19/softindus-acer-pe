"use server";

import { revalidatePath } from "next/cache";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { claimOperation, completeOperation, IdempotencyConflictError } from "@/lib/idempotency";
import { APP_ROLES } from "@/lib/permissions";
import { lockPurchaseRow } from "@/lib/row-locks";
import { calculateSupplierPayment } from "@/lib/supplier-payment-amounts";
import { supplierPaymentSchema } from "@/schemas/inventory/supplier-payment.schema";

function toNullable(value: string | undefined) {
  return value && value.trim() !== "" ? value.trim() : null;
}

/** Lo que el formulario de pago envio, para volver a mostrarlo. */
export type SupplierPaymentFormValues = {
  fecha_pago: string;
  monto_pagado: string;
  metodo_pago: string;
  observaciones: string;
};

// C4 de la 11.2a: el pago se registra desde su seccion del detalle de la compra y la
// accion devuelve el resultado; sin permiso responde con un error, no redirige. El
// exito lleva la clave confirmada para que el formulario genere otra (OperationKeyField).
export type SupplierPaymentFormState = FormActionState<
  SupplierPaymentFormValues,
  { id_pago_proveedor: string; clave_operacion: string }
>;

const PERMISSION_ERROR = "No tienes permisos para registrar pagos a proveedores.";
const OPERATION_TYPE = "registrar_pago_proveedor";

/** Un rechazo dentro de la transaccion: la deshace, y con ella el reclamo de la clave. */
class SupplierPaymentRejectedError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

function getSupplierPaymentFormValues(formData: FormData): SupplierPaymentFormValues {
  const text = (name: keyof SupplierPaymentFormValues) => formData.get(name)?.toString() ?? "";

  return {
    fecha_pago: text("fecha_pago"),
    monto_pagado: text("monto_pagado"),
    metodo_pago: text("metodo_pago"),
    observaciones: text("observaciones"),
  };
}

export async function createSupplierPaymentAction(
  _prevState: SupplierPaymentFormState,
  formData: FormData,
): Promise<SupplierPaymentFormState> {
  const values = getSupplierPaymentFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): SupplierPaymentFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail(PERMISSION_ERROR);
  }

  const parsed = supplierPaymentSchema.safeParse({
    id_compra: formData.get("id_compra"),
    clave_operacion: formData.get("clave_operacion"),
    fecha_pago: formData.get("fecha_pago"),
    monto_pagado: formData.get("monto_pagado"),
    metodo_pago: formData.get("metodo_pago"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La clave va en un campo oculto: su mensaje es el general, no el de un campo.
    const keyError = fieldErrors.clave_operacion?.[0];

    return fail(keyError ?? "Revisa los datos del pago.", fieldErrors);
  }

  const data = parsed.data;
  let idPagoProveedor: string;

  try {
    idPagoProveedor = await prisma.$transaction(async (tx) => {
      // La clave se reclama como primera sentencia: un reenvio con la misma clave
      // responde con el pago que ya se guardo, sin bloquear ni escribir nada.
      const claim = await claimOperation(tx, {
        clave: data.clave_operacion,
        tipo: OPERATION_TYPE,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene un pago registrado.");
        }

        return claim.idRegistro;
      }

      // C3 de la 11.2a: la compra se bloquea antes de leer lo que decide el pago (su
      // estado y los pagos anteriores). Dos pagos simultaneos, o un pago y una
      // anulacion, que toman el mismo candado se ponen en fila: el segundo ve lo que
      // el primero confirmo. Un rechazo lanza dentro de la transaccion, que se
      // deshace sin haber escrito nada y libera la clave.
      await lockPurchaseRow(tx, data.id_compra);

      const purchase = await tx.compra.findUnique({
        where: {
          id_compra: data.id_compra,
        },
      });

      if (!purchase) {
        throw new SupplierPaymentRejectedError("La compra seleccionada no existe.");
      }

      if (purchase.estado_compra === "anulada") {
        throw new SupplierPaymentRejectedError("No se puede registrar pagos en una compra anulada.");
      }

      if (purchase.estado_pago === "pagado") {
        throw new SupplierPaymentRejectedError("Esta compra ya está pagada.");
      }

      const previousPayments = await tx.pago_proveedor.findMany({
        where: {
          id_compra: data.id_compra,
        },
        select: {
          monto_pagado: true,
        },
      });

      // Hallazgos 1 y 2 de la 11.2a: el saldo se cuenta en centesimos enteros, con
      // el redondeo de las columnas, y se guarda exactamente lo que devuelve.
      const payment = calculateSupplierPayment({
        total: purchase.monto_total,
        previousPayments: previousPayments.map((previous) => previous.monto_pagado),
        amount: data.monto_pagado,
      });

      if (!payment.accepted) {
        const message = `El pago no puede superar el saldo pendiente. Saldo actual: S/ ${payment.balance}`;

        throw new SupplierPaymentRejectedError(message, { monto_pagado: [message] });
      }

      const idPago = await getNextCorrelativeId(tx, {
        codigoEntidad: "pago_proveedor",
        prefijo: "PPR",
      });

      await tx.pago_proveedor.create({
        data: {
          id_pago_proveedor: idPago,
          id_compra: data.id_compra,
          id_proveedor: purchase.id_proveedor,
          id_usuario_registro: session.user.id,
          fecha_pago: new Date(data.fecha_pago),
          monto_pagado: payment.amount,
          metodo_pago: data.metodo_pago,
          saldo_pendiente: payment.newBalance,
          estado_pago: payment.status,
          observaciones: toNullable(data.observaciones),
        },
      });

      await tx.compra.update({
        where: {
          id_compra: data.id_compra,
        },
        data: {
          estado_pago: payment.status,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "pago_proveedor",
        id_registro_afectado: idPago,
        accion: "crear",
        detalle: `Pago a proveedor registrado para la compra ${data.id_compra}.`,
        tx,
      });

      await completeOperation(tx, { clave: data.clave_operacion, idRegistro: idPago });

      return idPago;
    });
  } catch (error) {
    if (error instanceof SupplierPaymentRejectedError) {
      return fail(error.message, error.fieldErrors);
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/purchases");
  revalidatePath(`/dashboard/inventory/purchases/${data.id_compra}`);

  return {
    status: "success",
    data: { id_pago_proveedor: idPagoProveedor, clave_operacion: data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
}
