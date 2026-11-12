"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { checkReceiptAmount } from "@/lib/client-payment-amounts";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { claimOperation, completeOperation, IdempotencyConflictError } from "@/lib/idempotency";
import { APP_ROLES } from "@/lib/permissions";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockQuoteRow } from "@/lib/row-locks";
import { receiptSchema } from "@/schemas/commercial/receipt.schema";
import { operationKeySchema } from "@/schemas/operation-key.schema";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();

  return text ? text : null;
}

/** Lo que el formulario de comprobante envio, para volver a mostrarlo. */
export type ReceiptFormValues = {
  tipo_comprobante: string;
  numero_comprobante: string;
  monto_total: string;
  observaciones: string;
};

// C6 de la 11.3b (D32): emitir comprobante devuelve el resultado y su seccion del detalle de la
// proforma da el aviso, como el pago de cliente. Sin permiso responde con un error en la seccion;
// un rechazo ya no lleva a la pagina de error. El exito lleva la clave confirmada para que el
// formulario genere otra (OperationKeyField).
export type ReceiptFormState = FormActionState<
  ReceiptFormValues,
  { id_comprobante: string; clave_operacion: string }
>;

const RECEIPT_OPERATION = "emitir_comprobante";
const NUMBER_TAKEN = "Ya existe un comprobante con ese número.";

const receiptFormSchema = receiptSchema.extend({ clave_operacion: operationKeySchema });

/**
 * Un rechazo que se decide dentro de la transaccion, despues de reclamar la clave: se lanza para
 * que la transaccion se revierta y libere la clave (CLAUDE.md, Idempotent operations), y la
 * accion lo convierte en el error de la seccion o de su campo.
 */
class ReceiptValidationError extends Error {
  constructor(
    message: string,
    readonly field?: keyof ReceiptFormValues,
  ) {
    super(message);
  }
}

function getReceiptFormValues(formData: FormData): ReceiptFormValues {
  const text = (name: keyof ReceiptFormValues) => formData.get(name)?.toString() ?? "";

  return {
    tipo_comprobante: text("tipo_comprobante"),
    numero_comprobante: text("numero_comprobante"),
    monto_total: text("monto_total"),
    observaciones: text("observaciones"),
  };
}

export async function createReceiptAction(
  _prevState: ReceiptFormState,
  formData: FormData,
): Promise<ReceiptFormState> {
  const values = getReceiptFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): ReceiptFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.SELLER]);

  if (!session) {
    return fail("No tienes permisos para emitir comprobantes.");
  }

  const parsed = receiptFormSchema.safeParse({
    id_proforma: formData.get("id_proforma")?.toString(),
    tipo_comprobante: formData.get("tipo_comprobante")?.toString(),
    numero_comprobante: formData.get("numero_comprobante")?.toString(),
    monto_total: formData.get("monto_total"),
    observaciones: formData.get("observaciones")?.toString() ?? "",
    clave_operacion: formData.get("clave_operacion"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La proforma y la clave van en campos ocultos: su mensaje es el general, no el de un campo.
    const hiddenError = fieldErrors.clave_operacion?.[0] ?? fieldErrors.id_proforma?.[0];

    return fail(hiddenError ?? "Revisa los datos del comprobante.", fieldErrors);
  }

  const { id_proforma, tipo_comprobante, numero_comprobante, monto_total, clave_operacion } = parsed.data;
  let idComprobante: string;

  try {
    idComprobante = await prisma.$transaction(async (tx) => {
      // C6 de la 11.3b: la clave se reclama como primera sentencia, antes del bloqueo y del
      // correlativo. Un reenvio con la misma clave responde con el comprobante ya emitido; un
      // rechazo posterior lanza y libera la clave.
      const claim = await claimOperation(tx, {
        clave: clave_operacion,
        tipo: RECEIPT_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene un comprobante registrado.");
        }

        return claim.idRegistro;
      }

      // C5 de la 11.3b: la proforma se bloquea y se lee dentro de la transaccion, con su
      // comprobante emitido y el numero: dos comprobantes simultaneos para la misma proforma, o
      // uno y la anulacion de la proforma, van en fila.
      await lockQuoteRow(tx, id_proforma);

      const quote = await tx.proforma.findUnique({
        where: {
          id_proforma,
        },
        include: {
          comprobante_venta: {
            where: {
              estado: "emitido",
            },
            select: {
              id_comprobante: true,
              numero_comprobante: true,
            },
          },
        },
      });

      if (!quote) {
        throw new ReceiptValidationError("La proforma seleccionada no existe.");
      }

      if (quote.estado === "anulada") {
        throw new ReceiptValidationError("No se puede emitir comprobante para una proforma anulada.");
      }

      if (quote.comprobante_venta.length > 0) {
        throw new ReceiptValidationError(
          `Esta proforma ya tiene un comprobante emitido: ${quote.comprobante_venta[0].numero_comprobante}.`,
        );
      }

      // C5 de la 11.3b: el monto se compara y se guarda como lo guarda la columna, en centimos.
      const amount = checkReceiptAmount({ total: quote.monto_total, amount: monto_total });

      if (!amount.accepted) {
        throw new ReceiptValidationError(
          "El comprobante no puede superar el monto total de la proforma.",
          "monto_total",
        );
      }

      const existingNumber = await tx.comprobante_venta.findUnique({
        where: {
          numero_comprobante,
        },
        select: {
          id_comprobante: true,
        },
      });

      if (existingNumber) {
        throw new ReceiptValidationError(NUMBER_TAKEN, "numero_comprobante");
      }

      const id_comprobante = await getNextCorrelativeId(tx, {
        codigoEntidad: "comprobante_venta",
        prefijo: "CMP",
      });

      try {
        await tx.comprobante_venta.create({
          data: {
            id_comprobante,
            id_pedido: quote.id_pedido,
            id_proforma: quote.id_proforma,
            tipo_comprobante,
            numero_comprobante,
            fecha_emision: new Date(),
            monto_total: amount.amount,
            estado: "emitido",
            observaciones: emptyToNull(formData.get("observaciones")),
          },
        });
      } catch (error) {
        // Hallazgo 6 de la 11.3a: el numero lo tomo otro comprobante que confirmo despues de la
        // busqueda (no bloquea esta proforma). El unico indice unico de la tabla ademas de su
        // clave es el del numero, asi que un P2002 aqui es ese: va a su campo y no a la pagina
        // de error.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ReceiptValidationError(NUMBER_TAKEN, "numero_comprobante");
        }

        throw error;
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "comprobante_venta",
        id_registro_afectado: id_comprobante,
        accion: "crear",
        detalle: `Comprobante registrado: ${numero_comprobante}`,
        tx,
      });

      await completeOperation(tx, { clave: clave_operacion, idRegistro: id_comprobante });

      return id_comprobante;
    });
  } catch (error) {
    if (error instanceof ReceiptValidationError) {
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
  revalidatePath("/dashboard/commercial/receipts");

  return {
    status: "success",
    data: { id_comprobante: idComprobante, clave_operacion },
    values,
    operationId: newOperationId(),
  };
}

// C7 de la 11.3b (D33): anular se confirma con ConfirmActionButton y la accion devuelve
// RowStatusState. Antes volvia al listado sin decir nada si el comprobante no existia o ya estaba
// anulado, y escribia la anulacion y su bitacora sin transaccion. Decide sobre una sola condicion
// (que no este anulado), asi que basta un compare-and-set: la condicion y la escritura van en la
// misma sentencia y un doble clic o un listado viejo no anulan dos veces, sin bloquear la fila.
export async function annulReceiptAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const receiptId = formData.get("id_comprobante")?.toString().trim() ?? "";

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.SELLER]);

  if (!session) {
    return rowStatusError(receiptId, "No tienes permisos para anular comprobantes.");
  }

  if (!receiptId) {
    return rowStatusError(receiptId, "Debe seleccionar un comprobante válido.");
  }

  const annulled = await prisma.$transaction(async (tx) => {
    const [receipt] = await tx.comprobante_venta.updateManyAndReturn({
      where: {
        id_comprobante: receiptId,
        estado: {
          not: "anulado",
        },
      },
      data: {
        estado: "anulado",
      },
      select: {
        numero_comprobante: true,
        id_proforma: true,
      },
    });

    // Sin fila: no existe o ya estaba anulado. No hay nada que registrar.
    if (!receipt) {
      return null;
    }

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "comprobante_venta",
      id_registro_afectado: receiptId,
      accion: "anular",
      detalle: `Comprobante anulado: ${receipt.numero_comprobante}`,
      tx,
    });

    return receipt;
  });

  // Un rechazo no revalida: el repintado se llevaria el boton y su mensaje (CLAUDE.md).
  if (!annulled) {
    return rowStatusError(receiptId, "El comprobante no existe o ya estaba anulado.");
  }

  revalidatePath("/dashboard/commercial/receipts");
  revalidatePath("/dashboard/commercial/quotes");

  if (annulled.id_proforma) {
    revalidatePath(`/dashboard/commercial/quotes/${annulled.id_proforma}`);
  }

  return rowStatusDone(receiptId, "anulado");
}
