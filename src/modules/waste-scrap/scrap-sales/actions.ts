"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { formatCents, toCents } from "@/lib/decimal-cents";
import type { FieldErrors } from "@/lib/errors";
import { claimOperation, completeOperation, IdempotencyConflictError } from "@/lib/idempotency";
import { APP_ROLES } from "@/lib/permissions";
import { roundCashAmount } from "@/lib/petty-cash-amounts";
import { lockCashBoxRow, lockScrapRow } from "@/lib/row-locks";
import { operationKeySchema } from "@/schemas/operation-key.schema";
import { scrapSaleSchema } from "@/schemas/waste-scrap/scrap-sale.schema";

/** Centesimos de un peso o una cantidad, redondeados como su columna numeric(10, 2). */
function hundredths(value: { toString(): string }) {
  return toCents(value.toString()) ?? 0n;
}

/** Lo que el formulario de la venta envio, para volver a mostrarlo. */
export type ScrapSaleFormValues = {
  id_chatarra: string;
  id_caja_chica: string;
  fecha_venta: string;
  cantidad_vendida: string;
  peso_vendido_kg: string;
  monto_recibido: string;
  destino_dinero: string;
  observaciones: string;
};

// C4 de la 11.4b (D48): la venta devuelve el resultado y el formulario da el aviso y vuelve al
// listado de chatarra, como el egreso de caja chica (C5 de la 11.4a). Un error queda en el
// formulario, junto a su campo, en lugar de la pagina de error; sin permiso responde con un error.
// El exito lleva la clave confirmada para que el formulario genere otra (OperationKeyField).
export type ScrapSaleFormState = FormActionState<
  ScrapSaleFormValues,
  { id_venta_chatarra: string; clave_operacion: string }
>;

const SALE_OPERATION = "vender_chatarra";

const saleFormSchema = scrapSaleSchema.and(z.object({ clave_operacion: operationKeySchema }));

/**
 * Un rechazo que se decide dentro de la transaccion, despues de reclamar la clave: se lanza para
 * que la transaccion se revierta y libere la clave, y la accion lo convierte en el error de su
 * campo.
 */
class ScrapSaleValidationError extends Error {
  constructor(
    readonly field: keyof ScrapSaleFormValues,
    message: string,
  ) {
    super(message);
  }
}

function getScrapSaleFormValues(formData: FormData): ScrapSaleFormValues {
  const text = (name: keyof ScrapSaleFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_chatarra: text("id_chatarra"),
    id_caja_chica: text("id_caja_chica"),
    fecha_venta: text("fecha_venta"),
    cantidad_vendida: text("cantidad_vendida"),
    peso_vendido_kg: text("peso_vendido_kg"),
    monto_recibido: text("monto_recibido"),
    destino_dinero: text("destino_dinero"),
    observaciones: text("observaciones"),
  };
}

export async function createScrapSaleAction(
  _prevState: ScrapSaleFormState,
  formData: FormData,
): Promise<ScrapSaleFormState> {
  const values = getScrapSaleFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): ScrapSaleFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail("No tienes permisos para registrar ventas de chatarra.");
  }

  const parsed = saleFormSchema.safeParse({
    ...values,
    clave_operacion: formData.get("clave_operacion"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La clave va en un campo oculto: su mensaje es el general, no el de un campo.
    const keyError = fieldErrors.clave_operacion?.[0];

    return fail(keyError ?? "Revisa los datos de la venta.", fieldErrors);
  }

  const data = parsed.data;

  const fechaVenta = new Date(`${data.fecha_venta}T00:00:00`);
  // C2 de la 11.4b (D48): el monto redondeado como las columnas; el mismo texto va a la venta, al
  // movimiento y al aumento del saldo.
  const montoRecibido = roundCashAmount(data.monto_recibido);

  let idVentaChatarra: string;

  try {
    idVentaChatarra = await prisma.$transaction(async (tx) => {
      // C4 de la 11.4b: la clave se reclama como primera sentencia, antes de los candados y de los
      // correlativos. Un reenvio con la misma clave responde con la venta ya guardada sin crear
      // otra ni sumar dos veces el ingreso; un rechazo posterior lanza y libera la clave.
      const claim = await claimOperation(tx, {
        clave: data.clave_operacion,
        tipo: SALE_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene una venta registrada.");
        }

        return claim.idRegistro;
      }

      // C3 de la 11.4b (D48): la chatarra se bloquea antes de leerla y despues su caja antes de
      // leer su estado; la chatarra primero y la caja al final. Dos envios simultaneos leian la
      // chatarra fuera de la transaccion, los dos la veian sin vender y los dos la vendian: ahora
      // el segundo espera al primero y ve la venta.
      await lockScrapRow(tx, data.id_chatarra);

      const scrap = await tx.chatarra.findUnique({
        where: {
          id_chatarra: data.id_chatarra,
        },
        include: {
          venta_chatarra: true,
        },
      });

      if (!scrap) {
        throw new ScrapSaleValidationError("id_chatarra", "El registro de chatarra seleccionado no existe.");
      }

      if (scrap.estado === "vendida") {
        throw new ScrapSaleValidationError("id_chatarra", "Esta chatarra ya fue vendida.");
      }

      if (scrap.venta_chatarra.length > 0) {
        throw new ScrapSaleValidationError("id_chatarra", "Esta chatarra ya tiene una venta registrada.");
      }

      // C2 de la 11.4b (D48): el peso y la cantidad escritos se redondean como sus columnas
      // numeric(10, 2) antes de compararlos con lo registrado y de guardarlos; los que se dejan
      // vacios toman los de la chatarra, como antes.
      const pesoEscrito =
        data.peso_vendido_kg !== undefined ? formatCents(hundredths(data.peso_vendido_kg)) : undefined;
      const cantidadEscrita =
        data.cantidad_vendida !== undefined ? formatCents(hundredths(data.cantidad_vendida)) : undefined;

      const pesoVendido = pesoEscrito ?? scrap.peso_kg;
      const cantidadVendida = cantidadEscrita ?? scrap.cantidad;

      if (!pesoVendido && !cantidadVendida) {
        throw new ScrapSaleValidationError(
          "peso_vendido_kg",
          "Debe registrar peso vendido, cantidad vendida o tener esos datos en la chatarra seleccionada.",
        );
      }

      if (pesoEscrito && scrap.peso_kg && hundredths(scrap.peso_kg) > 0n) {
        if (hundredths(pesoEscrito) > hundredths(scrap.peso_kg)) {
          throw new ScrapSaleValidationError("peso_vendido_kg", "El peso vendido no puede superar el peso registrado.");
        }
      }

      if (cantidadEscrita && scrap.cantidad && hundredths(scrap.cantidad) > 0n) {
        if (hundredths(cantidadEscrita) > hundredths(scrap.cantidad)) {
          throw new ScrapSaleValidationError(
            "cantidad_vendida",
            "La cantidad vendida no puede superar la cantidad registrada.",
          );
        }
      }

      if (data.id_caja_chica) {
        await lockCashBoxRow(tx, data.id_caja_chica);

        const selectedCashBox = await tx.caja_chica.findUnique({
          where: {
            id_caja_chica: data.id_caja_chica,
          },
          select: {
            id_caja_chica: true,
            estado: true,
          },
        });

        if (!selectedCashBox) {
          throw new ScrapSaleValidationError("id_caja_chica", "La caja chica seleccionada no existe.");
        }

        if (selectedCashBox.estado !== "abierta") {
          throw new ScrapSaleValidationError("id_caja_chica", "Solo se puede registrar el ingreso en una caja abierta.");
        }
      }

      const idVenta = await getNextCorrelativeId(tx, {
        codigoEntidad: "venta_chatarra",
        prefijo: "VCH",
      });

      const idMovimientoCaja = data.id_caja_chica
        ? await getNextCorrelativeId(tx, {
            codigoEntidad: "movimiento_caja",
            prefijo: "MCA",
          })
        : null;

      if (data.id_caja_chica && idMovimientoCaja) {
        await tx.movimiento_caja.create({
          data: {
            id_movimiento_caja: idMovimientoCaja,
            id_caja_chica: data.id_caja_chica,
            id_usuario_registro: session.user.id,
            tipo_movimiento: "ingreso",
            concepto: `Venta de chatarra ${scrap.id_chatarra}`,
            monto: montoRecibido,
            fecha_movimiento: fechaVenta,
            responsable: session.user.name ?? "Administrador",
            observaciones:
              data.destino_dinero ??
              "Ingreso generado por venta de chatarra.",
          },
        });

        await tx.caja_chica.update({
          where: {
            id_caja_chica: data.id_caja_chica,
          },
          data: {
            saldo_actual: {
              increment: montoRecibido,
            },
          },
        });
      }

      if (idMovimientoCaja) {
        await registerAuditLog({
          userId: session.user.id,
          entidad_afectada: "movimiento_caja",
          id_registro_afectado: idMovimientoCaja,
          accion: "crear",
          detalle: `Movimiento de caja creado por venta de chatarra ${data.id_chatarra}.`,
          tx,
        });
      }

      await tx.venta_chatarra.create({
        data: {
          id_venta_chatarra: idVenta,
          id_chatarra: data.id_chatarra,
          id_movimiento_caja: idMovimientoCaja,
          fecha_venta: fechaVenta,
          cantidad_vendida: cantidadVendida ?? null,
          peso_vendido_kg: pesoVendido ?? null,
          monto_recibido: montoRecibido,
          destino_dinero: data.destino_dinero,
          id_usuario_registro: session.user.id,
          observaciones: data.observaciones,
        },
      });

      await tx.chatarra.update({
        where: {
          id_chatarra: data.id_chatarra,
        },
        data: {
          estado: "vendida",
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "venta_chatarra",
        id_registro_afectado: idVenta,
        accion: "crear",
        detalle: `Venta de chatarra registrada para ${data.id_chatarra}.`,
        tx,
      });

      await completeOperation(tx, { clave: data.clave_operacion, idRegistro: idVenta });

      return idVenta;
    });
  } catch (error) {
    if (error instanceof ScrapSaleValidationError) {
      return fail(error.message, { [error.field]: [error.message] });
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");
  revalidatePath("/dashboard/waste-scrap/scraps");
  revalidatePath("/dashboard/waste-scrap/scrap-sales/new");
  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/movements");
  revalidatePath("/dashboard/petty-cash/monthly-summary");
  revalidatePath("/dashboard/petty-cash/monthly-summary");

  return {
    status: "success",
    data: { id_venta_chatarra: idVentaChatarra, clave_operacion: data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
}
