"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { calculateQuoteAmounts } from "@/lib/client-payment-amounts";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { claimOperation, completeOperation, IdempotencyConflictError } from "@/lib/idempotency";
import { APP_ROLES } from "@/lib/permissions";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockOrderRow, lockQuoteRow } from "@/lib/row-locks";
import {
  NOT_QUOTABLE_ORDER_MESSAGE,
  QUOTABLE_ORDER_STATES,
} from "@/modules/commercial/quotes/quote-rules";
import { quoteSchema } from "@/schemas/commercial/quote.schema";
import { operationKeySchema } from "@/schemas/operation-key.schema";

const QUOTES_PATH = "/dashboard/commercial/quotes";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();

  return text ? text : null;
}

/** Lo que el formulario de proforma envio, para volver a mostrarlo. */
export type QuoteFormValues = {
  id_pedido: string;
  adelanto_inicial: string;
  metodo_pago_adelanto: string;
  validez_dias: string;
  observaciones: string;
};

// C4 de la 11.3a (D27): crear proforma devuelve el resultado y el formulario da el aviso y
// vuelve al listado, como crear compra. Sin permiso responde con un error en el formulario. El
// exito lleva la clave confirmada para que el formulario genere otra (OperationKeyField).
export type QuoteFormState = FormActionState<
  QuoteFormValues,
  { id_proforma: string; clave_operacion: string }
>;

const QUOTE_OPERATION = "crear_proforma";

const quoteFormSchema = quoteSchema.and(z.object({ clave_operacion: operationKeySchema }));

/**
 * Un rechazo que se decide dentro de la transaccion, despues de reclamar la clave: se lanza
 * para que la transaccion se revierta y libere la clave (CLAUDE.md, Idempotent operations), y
 * la accion lo convierte en el error de su campo.
 */
class QuoteValidationError extends Error {
  constructor(
    readonly field: keyof QuoteFormValues,
    message: string,
  ) {
    super(message);
  }
}

function getQuoteFormValues(formData: FormData): QuoteFormValues {
  const text = (name: keyof QuoteFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_pedido: text("id_pedido"),
    adelanto_inicial: text("adelanto_inicial"),
    metodo_pago_adelanto: text("metodo_pago_adelanto"),
    validez_dias: text("validez_dias"),
    observaciones: text("observaciones"),
  };
}

export async function createQuoteAction(
  _prevState: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const values = getQuoteFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): QuoteFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.SELLER]);

  if (!session) {
    return fail("No tienes permisos para crear proformas.");
  }

  const parsed = quoteFormSchema.safeParse({
    id_pedido: formData.get("id_pedido")?.toString(),
    adelanto_inicial: formData.get("adelanto_inicial"),
    metodo_pago_adelanto: formData.get("metodo_pago_adelanto"),
    validez_dias: formData.get("validez_dias"),
    observaciones: formData.get("observaciones")?.toString() ?? "",
    clave_operacion: formData.get("clave_operacion"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La clave va en un campo oculto: su mensaje es el general, no el de un campo.
    const keyError = fieldErrors.clave_operacion?.[0];

    return fail(keyError ?? "Revisa los datos de la proforma.", fieldErrors);
  }

  const data = parsed.data;
  let idProforma: string;

  try {
    idProforma = await prisma.$transaction(async (tx) => {
      // C4 de la 11.3a: la clave se reclama como primera sentencia, antes del bloqueo y de los
      // correlativos. Un reenvio con la misma clave responde con la proforma ya guardada sin
      // crear otra ni registrar el adelanto dos veces; un rechazo posterior lanza y libera la
      // clave.
      const claim = await claimOperation(tx, {
        clave: data.clave_operacion,
        tipo: QUOTE_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene una proforma registrada.");
        }

        return claim.idRegistro;
      }

      // C3 de la 11.3a (hallazgos 3 y 4): el pedido se bloquea y se lee dentro de la
      // transaccion, asi dos altas simultaneas, o un alta y cancelar el pedido, van en fila.
      await lockOrderRow(tx, data.id_pedido);

      const order = await tx.pedido.findUnique({
        where: {
          id_pedido: data.id_pedido,
        },
        include: {
          detalle_pedido: {
            select: {
              subtotal: true,
            },
          },
          proforma: {
            where: {
              estado: {
                in: ["vigente", "aceptada", "pagada"],
              },
            },
            select: {
              id_proforma: true,
              numero_proforma: true,
              estado: true,
            },
          },
        },
      });

      if (!order) {
        throw new QuoteValidationError("id_pedido", "El pedido seleccionado no existe.");
      }

      // D29: solo un pedido registrado o aprobado, el mismo criterio de la lista del formulario.
      if (!QUOTABLE_ORDER_STATES.includes(order.estado)) {
        throw new QuoteValidationError("id_pedido", NOT_QUOTABLE_ORDER_MESSAGE);
      }

      if (order.detalle_pedido.length === 0) {
        throw new QuoteValidationError("id_pedido", "El pedido no tiene productos asociados.");
      }

      if (order.proforma.length > 0) {
        throw new QuoteValidationError(
          "id_pedido",
          `Este pedido ya tiene una proforma activa: ${order.proforma[0].numero_proforma}.`,
        );
      }

      // C2 de la 11.3a (hallazgo 1): total, adelanto y saldo en centimos, redondeados como las
      // columnas (client-payment-amounts.ts).
      const amounts = calculateQuoteAmounts({
        subtotals: order.detalle_pedido.map((detail) => detail.subtotal),
        advance: data.adelanto_inicial,
      });

      if (!amounts.accepted) {
        throw amounts.reason === "sin_total"
          ? new QuoteValidationError("id_pedido", "El monto total de la proforma debe ser mayor que cero.")
          : new QuoteValidationError("adelanto_inicial", "El adelanto inicial no puede ser mayor que el monto total.");
      }

      const adelantoInicial = amounts.advance;
      const saldo = amounts.balance;

      const id_proforma = await getNextCorrelativeId(tx, {
        codigoEntidad: "proforma",
        prefijo: "PRF",
      });
      const numero_proforma = id_proforma.replace("PRF", "PF-");
      const fechaEmision = new Date();

      // Sin adelanto la proforma nace vigente; con adelanto el cliente ya la
      // aceptó y pagó algo, así que sigue los mismos estados que un pago normal
      // (ver createPaymentAction).
      const estado = amounts.status;

      await tx.proforma.create({
        data: {
          id_proforma,
          id_pedido: data.id_pedido,
          numero_proforma,
          fecha_emision: fechaEmision,
          monto_total: amounts.total,
          adelanto_inicial: adelantoInicial,
          saldo,
          estado,
          validez_dias: data.validez_dias ?? null,
          observaciones: emptyToNull(formData.get("observaciones")),
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "proforma",
        id_registro_afectado: id_proforma,
        accion: "crear",
        detalle: `Proforma creada para el pedido ${data.id_pedido}.`,
        tx,
      });

      // El adelanto es dinero que ya entró: se registra como pago_cliente para
      // que aparezca en el historial de pagos, quede en la trazabilidad y
      // bloquee la anulación de una proforma ya cobrada.
      if (adelantoInicial !== null) {
        const id_pago_cliente = await getNextCorrelativeId(tx, {
          codigoEntidad: "pago_cliente",
          prefijo: "PCL",
        });

        await tx.pago_cliente.create({
          data: {
            id_pago_cliente,
            id_proforma,
            id_pedido: data.id_pedido,
            id_usuario_registro: session.user.id,
            fecha_pago: fechaEmision,
            monto_pagado: adelantoInicial,
            metodo_pago: data.metodo_pago_adelanto ?? "efectivo",
            tipo_pago: estado === "pagada" ? "cancelacion" : "adelanto",
            saldo_actual: saldo,
            observaciones: "Adelanto inicial registrado al crear la proforma.",
          },
        });

        await registerAuditLog({
          userId: session.user.id,
          entidad_afectada: "pago_cliente",
          id_registro_afectado: id_pago_cliente,
          accion: "crear",
          detalle: `Adelanto inicial registrado para la proforma ${id_proforma}.`,
          tx,
        });
      }

      await completeOperation(tx, { clave: data.clave_operacion, idRegistro: id_proforma });

      return id_proforma;
    });
  } catch (error) {
    if (error instanceof QuoteValidationError) {
      return fail(error.message, { [error.field]: [error.message] });
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath(QUOTES_PATH);
  revalidatePath("/dashboard/commercial/orders");

  return {
    status: "success",
    data: { id_proforma: idProforma, clave_operacion: data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
}

// C6 de la 11.3a (D28): anular se confirma con ConfirmActionButton y la accion devuelve
// RowStatusState. Antes redirigia al listado o al detalle sin decir por que no anulaba; ahora el
// rechazo (tiene pagos, tiene un comprobante emitido, ya estaba anulada) queda en la
// confirmacion, y sin permiso responde con un error en lugar de redirigir.
export async function annulQuoteAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const quoteId = formData.get("id_proforma")?.toString().trim() ?? "";

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.SELLER]);

  if (!session) {
    return rowStatusError(quoteId, "No tienes permisos para anular proformas.");
  }

  if (!quoteId) {
    return rowStatusError(quoteId, "Debe seleccionar una proforma válida.");
  }

  // C3 de la 11.3a (hallazgo 4): la proforma se bloquea y se lee dentro de la transaccion, y la
  // anulacion y su bitacora se escriben en ella: un pago simultaneo espera y ve la anulacion.
  // Sin clave de operacion, un rechazo se devuelve desde la transaccion antes de escribir nada.
  const rejection = await prisma.$transaction(async (tx) => {
    await lockQuoteRow(tx, quoteId);

    const quote = await tx.proforma.findUnique({
      where: {
        id_proforma: quoteId,
      },
      include: {
        pago_cliente: {
          select: {
            id_pago_cliente: true,
          },
        },
        comprobante_venta: {
          where: {
            estado: "emitido",
          },
          select: {
            id_comprobante: true,
          },
        },
      },
    });

    if (!quote) {
      return "La proforma seleccionada no existe.";
    }

    if (quote.estado === "anulada") {
      return "La proforma ya está anulada.";
    }

    if (quote.pago_cliente.length > 0) {
      return "No se puede anular una proforma con pagos registrados.";
    }

    if (quote.comprobante_venta.length > 0) {
      return "No se puede anular una proforma con un comprobante emitido.";
    }

    await tx.proforma.update({
      where: {
        id_proforma: quoteId,
      },
      data: {
        estado: "anulada",
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "proforma",
      id_registro_afectado: quoteId,
      accion: "anular",
      detalle: `Proforma anulada: ${quote.numero_proforma}`,
      tx,
    });

    return null;
  });

  // Un rechazo no revalida: el repintado se llevaria el boton y su mensaje (CLAUDE.md).
  if (rejection) {
    return rowStatusError(quoteId, rejection);
  }

  revalidatePath(QUOTES_PATH);
  revalidatePath(`${QUOTES_PATH}/${quoteId}`);
  revalidatePath("/dashboard/commercial/orders");

  return rowStatusDone(quoteId, "anulada");
}
