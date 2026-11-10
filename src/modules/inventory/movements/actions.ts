"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { formatCents, toCents } from "@/lib/decimal-cents";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { claimOperation, completeOperation, IdempotencyConflictError } from "@/lib/idempotency";
import { APP_ROLES } from "@/lib/permissions";
import { toNumber } from "@/lib/numbers";
import { lockWorkOrderRow } from "@/lib/row-locks";
import { syncStockAlert } from "@/modules/inventory/alerts/stock-alert-sync";
import { operationKeySchema } from "@/schemas/operation-key.schema";

type MaterialLockRow = {
  id_material: string;
  nombre_material: string;
  stock_actual: Prisma.Decimal;
  stock_reservado: Prisma.Decimal;
  stock_minimo: Prisma.Decimal;
  estado: boolean;
};

/** Lo que el formulario de salida envio, para volver a mostrarlo. */
export type InventoryOutputFormValues = {
  id_material: string;
  id_orden_trabajo: string;
  cantidad: string;
  motivo: string;
};

// C2 de la 11.2c: la salida devuelve el resultado y el formulario da el aviso y vuelve al
// listado, como crear compra. Sin permiso responde con un error, no redirige: era la
// desviacion conocida, la ultima accion de useActionState que redirigia. El exito lleva la
// clave confirmada para que el formulario genere otra (OperationKeyField).
export type InventoryOutputFormState = FormActionState<
  InventoryOutputFormValues,
  { id_movimiento: string; clave_operacion: string }
>;

const OUTPUT_OPERATION = "registrar_salida";

const outputSchema = z.object({
  id_material: z.string().trim().min(1, "Seleccione un material."),
  id_orden_trabajo: z.string().trim().optional().or(z.literal("")),
  // Clave de idempotencia del formulario (C2 de la 11.2c).
  clave_operacion: operationKeySchema,
  // Hallazgo 2 de la 11.2c: la columna numeric(10, 2) guardaria 0.004 como 0.00. La cantidad se
  // mide en centesimos, con el redondeo de la columna: una sola regla rechaza el cero, los
  // negativos y lo que se guardaria como cero.
  cantidad: z.coerce
    .number()
    .refine((value) => (toCents(value) ?? 0n) > 0n, "La cantidad debe ser mayor que cero."),
  motivo: z
    .string()
    .trim()
    .min(3, "El motivo es obligatorio.")
    .max(300, "El motivo no debe superar 300 caracteres."),
});

type InventoryOutputField = "id_material" | "id_orden_trabajo" | "cantidad";

class InventoryOutputValidationError extends Error {
  field: InventoryOutputField;

  constructor(field: InventoryOutputField, message: string) {
    super(message);
    this.field = field;
  }
}

function getOutputFormValues(formData: FormData): InventoryOutputFormValues {
  const text = (name: keyof InventoryOutputFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_material: text("id_material"),
    id_orden_trabajo: text("id_orden_trabajo"),
    cantidad: text("cantidad"),
    motivo: text("motivo"),
  };
}

export async function createInventoryOutputAction(
  _prevState: InventoryOutputFormState,
  formData: FormData,
): Promise<InventoryOutputFormState> {
  const values = getOutputFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): InventoryOutputFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  if (!session) {
    return fail("No tienes permisos para registrar salidas de inventario.");
  }

  const parsed = outputSchema.safeParse({
    id_material: formData.get("id_material"),
    id_orden_trabajo: formData.get("id_orden_trabajo") ?? "",
    clave_operacion: formData.get("clave_operacion"),
    cantidad: formData.get("cantidad"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La clave va en un campo oculto: su mensaje es el general, no el de un campo.
    const keyError = fieldErrors.clave_operacion?.[0];

    return fail(keyError ?? "Revisa los datos de la salida.", fieldErrors);
  }

  const data = parsed.data;

  // Hallazgo 1 de la 11.2c: la cantidad se redondea como la columna antes de compararla con el
  // disponible y de restarla, asi el kardex cuadra (anterior - cantidad = resultante) con lo que
  // guardan las columnas.
  const cantidad = new Prisma.Decimal(formatCents(toCents(data.cantidad) ?? 0n));

  let idMovimiento: string;

  try {
    idMovimiento = await prisma.$transaction(async (tx) => {
      // C2 de la 11.2c: la clave se reclama como primera sentencia, antes de los bloqueos y del
      // correlativo. Un reenvio con la misma clave responde con la salida ya guardada sin
      // descontar el stock otra vez; un rechazo posterior lanza y libera la clave.
      const claim = await claimOperation(tx, {
        clave: data.clave_operacion,
        tipo: OUTPUT_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene un movimiento registrado.");
        }

        return claim.idRegistro;
      }

      // H9: la salida a una orden aplica la misma regla que la entrega desde la orden, con
      // la orden bloqueada antes de leerla y antes del correlativo y del material (el
      // mismo orden de bloqueos que la entrega). Antes solo se comprobaba, fuera de la
      // transaccion, que la orden existiera.
      if (data.id_orden_trabajo) {
        await lockWorkOrderRow(tx, data.id_orden_trabajo);

        const workOrder = await tx.orden_trabajo.findUnique({
          where: {
            id_orden_trabajo: data.id_orden_trabajo,
          },
          select: {
            id_orden_trabajo: true,
            estado: true,
            fecha_cierre_materiales: true,
          },
        });

        if (!workOrder) {
          throw new InventoryOutputValidationError(
            "id_orden_trabajo",
            "La orden de trabajo seleccionada no existe.",
          );
        }

        if (workOrder.estado === "anulada" || workOrder.estado === "finalizada") {
          throw new InventoryOutputValidationError(
            "id_orden_trabajo",
            "No se puede entregar material a una orden anulada o finalizada.",
          );
        }

        if (workOrder.fecha_cierre_materiales) {
          throw new InventoryOutputValidationError(
            "id_orden_trabajo",
            "Los materiales de esta orden ya fueron cerrados.",
          );
        }
      }

      const newId = await getNextCorrelativeId(tx, {
        codigoEntidad: "movimiento_inventario",
        prefijo: "MVI",
      });

      const rows = await tx.$queryRaw<MaterialLockRow[]>(Prisma.sql`
        SELECT id_material, nombre_material, stock_actual, stock_reservado, stock_minimo, estado
        FROM aceros.material
        WHERE id_material = ${data.id_material}
        FOR UPDATE
      `);

      const material = rows[0];

      if (!material || !material.estado) {
        throw new InventoryOutputValidationError(
          "id_material",
          "El material seleccionado no existe o esta inactivo.",
        );
      }

      const stockDisponible = material.stock_actual.minus(material.stock_reservado);

      if (cantidad.greaterThan(stockDisponible)) {
        throw new InventoryOutputValidationError(
          "cantidad",
          "No hay stock suficiente para registrar la salida.",
        );
      }

      const stockResultante = material.stock_actual.minus(cantidad);

      await tx.material.update({
        where: {
          id_material: data.id_material,
        },
        data: {
          stock_actual: stockResultante,
        },
      });

      await tx.movimiento_inventario.create({
        data: {
          id_movimiento: newId,
          id_material: data.id_material,
          id_orden_trabajo: data.id_orden_trabajo || null,
          tipo_movimiento: "salida",
          cantidad,
          stock_anterior: material.stock_actual,
          stock_resultante: stockResultante,
          motivo: data.motivo,
          id_usuario_responsable: session.user.id,
        },
      });

      // C4 de la 11.2c (D16): la misma regla de alertas que la entrega a una orden, con el
      // stock calculado bajo el bloqueo del material (regla 5), no uno leido antes.
      await syncStockAlert(tx, {
        idMaterial: data.id_material,
        materialName: material.nombre_material,
        stockResultante: toNumber(stockResultante),
        stockMinimo: toNumber(material.stock_minimo),
        idOrdenTrabajo: data.id_orden_trabajo || null,
        idUsuario: session.user.id,
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "movimiento_inventario",
        id_registro_afectado: newId,
        accion: "crear",
        detalle: data.id_orden_trabajo
          ? `Salida de inventario registrada para orden: ${data.id_orden_trabajo}`
          : `Salida de inventario registrada: ${material.nombre_material}`,
        tx,
      });

      await completeOperation(tx, { clave: data.clave_operacion, idRegistro: newId });

      return newId;
    });
  } catch (error) {
    if (error instanceof InventoryOutputValidationError) {
      return fail(error.message, { [error.field]: [error.message] });
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/materials");
  revalidatePath("/dashboard/inventory/outputs");
  revalidatePath("/dashboard/inventory/alerts");

  return {
    status: "success",
    data: { id_movimiento: idMovimiento, clave_operacion: data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
}
