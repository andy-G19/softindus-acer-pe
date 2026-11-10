"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { claimOperation, completeOperation, IdempotencyConflictError } from "@/lib/idempotency";
import { calculatePurchaseAmounts } from "@/lib/purchase-amounts";
import { APP_ROLES } from "@/lib/permissions";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockPurchaseRow } from "@/lib/row-locks";
import { purchaseSchema } from "@/schemas/inventory/purchase.schema";

const ALREADY_ANNULLED = "La compra ya está anulada.";

function toNullable(value: string | undefined) {
  return value && value.trim() !== "" ? value.trim() : null;
}

/**
 * Un rechazo de la anulacion dentro de su transaccion: la deshace (incluido el stock
 * ya revertido de otros materiales) y su mensaje es la respuesta.
 */
class PurchaseAnnulmentRejectedError extends Error {}

/** Una linea de la compra tal como se envio. */
export type PurchaseLineValues = {
  id_material: string;
  cantidad: string;
  unidad_medida: string;
  costo_unitario: string;
  observaciones: string;
};

/** Lo que el formulario de compra envio, tal cual, para volver a mostrarlo. */
export type PurchaseFormValues = {
  id_proveedor: string;
  fecha_compra: string;
  tipo_comprobante: string;
  numero_comprobante: string;
  aplica_igv: boolean;
  observaciones: string;
  items: PurchaseLineValues[];
};

// C3 de la 11.2b: crear compra no redirige; devuelve el resultado y el formulario da el aviso
// y vuelve al listado (D17 y D19 revisada, como pedidos). Sin permiso responde con un error.
// Los errores de una linea van con la clave items.<posicion>.<campo>. El exito lleva la clave
// confirmada para que el formulario genere otra (OperationKeyField).
export type PurchaseFormState = FormActionState<
  PurchaseFormValues,
  { id_compra: string; clave_operacion: string }
>;

const CREATE_OPERATION = "crear_compra";
const REPEATED_MATERIAL =
  "No repitas el mismo material dentro de la compra. Ajusta la cantidad en una sola fila.";
const INACTIVE_MATERIAL = "El material seleccionado no existe o está inactivo.";

/** Un rechazo dentro de la transaccion: la deshace, y con ella el reclamo de la clave. */
class PurchaseRejectedError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

function getPurchaseFormValues(formData: FormData): PurchaseFormValues {
  const text = (name: string) => formData.get(name)?.toString() ?? "";
  const all = (name: string) => formData.getAll(name).map((value) => value.toString());
  const quantities = all("cantidad");
  const units = all("unidad_medida");
  const unitCosts = all("costo_unitario");
  const observations = all("item_observaciones");

  return {
    id_proveedor: text("id_proveedor"),
    fecha_compra: text("fecha_compra"),
    tipo_comprobante: text("tipo_comprobante"),
    numero_comprobante: text("numero_comprobante"),
    aplica_igv: formData.get("aplica_igv") === "on",
    observaciones: text("observaciones"),
    items: all("id_material").map((id_material, index) => ({
      id_material,
      cantidad: quantities[index] ?? "",
      unidad_medida: units[index] ?? "",
      costo_unitario: unitCosts[index] ?? "",
      observaciones: observations[index] ?? "",
    })),
  };
}

function addFieldError(errors: FieldErrors, key: string, message: string) {
  errors[key] = [...(errors[key] ?? []), message];
}

// Errores de Zod por campo: los de una linea, con la clave items.<posicion>.<campo>. Todas las
// lineas se envian, asi que la posicion en items es la del formulario.
function schemaFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: FieldErrors = {};

  for (const issue of issues) {
    const [first, index, field] = issue.path;
    const key =
      first === "items" && typeof index === "number"
        ? `items.${index}${field === undefined ? "" : `.${String(field)}`}`
        : String(first);

    addFieldError(errors, key, issue.message);
  }

  return errors;
}

export async function createPurchaseAction(
  _prevState: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const values = getPurchaseFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): PurchaseFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail("No tienes permisos para registrar compras.");
  }

  const parsed = purchaseSchema.safeParse({
    id_proveedor: formData.get("id_proveedor"),
    clave_operacion: formData.get("clave_operacion"),
    fecha_compra: formData.get("fecha_compra"),
    tipo_comprobante: formData.get("tipo_comprobante"),
    numero_comprobante: formData.get("numero_comprobante"),
    aplica_igv: formData.get("aplica_igv"),
    observaciones: formData.get("observaciones"),
    items: values.items,
  });

  if (!parsed.success) {
    const fieldErrors = schemaFieldErrors(parsed.error.issues);
    // La clave va en un campo oculto: su mensaje es el general, no el de un campo.
    const keyError = fieldErrors.clave_operacion?.[0];

    return fail(keyError ?? "Revisa los datos de la compra.", fieldErrors);
  }

  const data = parsed.data;

  // Un material repetido se marca en cada linea que lo repite.
  const repeated: FieldErrors = {};

  data.items.forEach((item, index) => {
    if (data.items.findIndex((other) => other.id_material === item.id_material) !== index) {
      addFieldError(repeated, `items.${index}.id_material`, REPEATED_MATERIAL);
    }
  });

  if (Object.keys(repeated).length > 0) {
    return fail(REPEATED_MATERIAL, repeated);
  }

  // Hallazgos 1 a 3 y 6 de la 11.2b: los montos se cuentan en centesimos enteros, con el
  // redondeo de las columnas, y se guarda exactamente lo que devuelve la funcion.
  const amounts = calculatePurchaseAmounts({ items: data.items, aplicaIgv: data.aplica_igv });
  let idCompra: string;

  try {
    idCompra = await prisma.$transaction(async (tx) => {
      // La clave se reclama como primera sentencia: un reenvio con la misma clave responde
      // con la compra que ya se guardo, sin leer ni escribir nada (C3 de la 11.2b).
      const claim = await claimOperation(tx, {
        clave: data.clave_operacion,
        tipo: CREATE_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene una compra registrada.");
        }

        return claim.idRegistro;
      }

      // D20 de la 11.2b: el proveedor y los materiales se comprueban dentro de la
      // transaccion, sin bloquear su fila: la compra solo exige que esten activos al
      // registrarla, y el stock se suma de forma atomica abajo.
      const supplier = await tx.proveedor.findFirst({
        where: {
          id_proveedor: data.id_proveedor,
          estado: true,
        },
      });

      if (!supplier) {
        const message = "El proveedor seleccionado no existe o está inactivo.";

        throw new PurchaseRejectedError(message, { id_proveedor: [message] });
      }

      const materials = await tx.material.findMany({
        where: {
          id_material: {
            in: data.items.map((item) => item.id_material),
          },
          estado: true,
        },
      });
      const activeIds = new Set(materials.map((material) => material.id_material));
      const inactive: FieldErrors = {};

      data.items.forEach((item, index) => {
        if (!activeIds.has(item.id_material)) {
          addFieldError(inactive, `items.${index}.id_material`, INACTIVE_MATERIAL);
        }
      });

      if (Object.keys(inactive).length > 0) {
        throw new PurchaseRejectedError("Uno o más materiales no existen o están inactivos.", inactive);
      }

      const newId = await getNextCorrelativeId(tx, {
        codigoEntidad: "compra",
        prefijo: "COM",
      });
      const detailIds = await getNextCorrelativeIds(tx, {
        codigoEntidad: "detalle_compra",
        prefijo: "DCO",
        cantidad: data.items.length,
      });
      const movementIds = await getNextCorrelativeIds(tx, {
        codigoEntidad: "movimiento_inventario",
        prefijo: "MVI",
        cantidad: data.items.length,
      });
      const historyIds = await getNextCorrelativeIds(tx, {
        codigoEntidad: "historial_precio_proveedor",
        prefijo: "HPP",
        cantidad: data.items.length,
      });

      await tx.compra.create({
        data: {
          id_compra: newId,
          id_proveedor: data.id_proveedor,
          id_usuario_registro: session.user.id,
          fecha_compra: new Date(data.fecha_compra),
          tipo_comprobante: data.tipo_comprobante ?? null,
          numero_comprobante: data.numero_comprobante ?? null,
          subtotal: amounts.subtotal,
          igv: amounts.igv,
          monto_total: amounts.total,
          estado_pago: "pendiente",
          estado_compra: "confirmada",
          observaciones: toNullable(data.observaciones),
        },
      });

      for (const [index, item] of data.items.entries()) {
        // La cantidad ya viene redondeada como la columna Decimal(10, 2): asi el stock
        // anterior que se deduce abajo (resultante - cantidad) coincide con el de la base.
        const line = amounts.lines[index];
        const cantidad = new Prisma.Decimal(line.cantidad);

        await tx.detalle_compra.create({
          data: {
            id_detalle_compra: detailIds[index],
            id_compra: newId,
            id_material: item.id_material,
            cantidad: line.cantidad,
            unidad_medida: item.unidad_medida,
            costo_unitario: line.costo_unitario,
            subtotal: line.subtotal,
            observaciones: toNullable(item.observaciones),
          },
        });

        // La suma la hace PostgreSQL sobre el valor vigente y la fila queda bloqueada hasta
        // el commit. Leer el stock antes y escribir el total perderia las compras que
        // confirmen en medio.
        const updatedMaterial = await tx.material.update({
          where: {
            id_material: item.id_material,
          },
          data: {
            stock_actual: {
              increment: cantidad,
            },
            costo_unitario_actual: line.costo_unitario,
          },
          select: {
            stock_actual: true,
            stock_minimo: true,
          },
        });

        const stockResultante = updatedMaterial.stock_actual;
        const stockAnterior = stockResultante.minus(cantidad);

        if (stockResultante.greaterThan(updatedMaterial.stock_minimo)) {
          await tx.alerta_stock.updateMany({
            where: {
              id_material: item.id_material,
              estado_alerta: "activa",
            },
            data: {
              estado_alerta: "atendida",
              fecha_atencion: new Date(),
              id_usuario_atencion: session.user.id,
            },
          });
        }

        await tx.movimiento_inventario.create({
          data: {
            id_movimiento: movementIds[index],
            id_material: item.id_material,
            id_compra: newId,
            tipo_movimiento: "entrada",
            cantidad,
            stock_anterior: stockAnterior,
            stock_resultante: stockResultante,
            motivo: "Entrada automática generada por compra confirmada",
            id_usuario_responsable: session.user.id,
          },
        });

        await tx.historial_precio_proveedor.create({
          data: {
            id_historial_precio: historyIds[index],
            id_proveedor: data.id_proveedor,
            id_material: item.id_material,
            id_compra: newId,
            precio_unitario: line.costo_unitario,
            fecha_registro: new Date(data.fecha_compra),
            origen_registro: "compra",
            observaciones: "Precio registrado automáticamente desde compra.",
          },
        });
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "compra",
        id_registro_afectado: newId,
        accion: "crear",
        detalle: `Compra creada con ${data.items.length} material(es).`,
        tx,
      });

      await completeOperation(tx, { clave: data.clave_operacion, idRegistro: newId });

      return newId;
    });
  } catch (error) {
    if (error instanceof PurchaseRejectedError) {
      return fail(error.message, error.fieldErrors);
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/materials");
  revalidatePath("/dashboard/inventory/purchases");

  return {
    status: "success",
    data: { id_compra: idCompra, clave_operacion: data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
}

// C5 de la 11.2a: anular se pide desde la fila del listado o desde el detalle con
// ConfirmActionButton y la accion devuelve RowStatusState. Antes redirigia al listado o al
// detalle sin decir por que no se anulaba; ahora el rechazo queda en la confirmacion. Un
// rechazo no revalida: el repintado se llevaria el boton y su mensaje.
export async function annulPurchaseAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const purchaseId = formData.get("id_compra")?.toString().trim() ?? "";

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return rowStatusError(purchaseId, "No tienes permisos para anular compras.");
  }

  if (!purchaseId) {
    return rowStatusError(purchaseId, "Debe seleccionar una compra válida.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      // C3 de la 11.2a: la compra se bloquea antes de leer si tiene pagos. El pago a
      // proveedor toma el mismo candado, asi que uno que confirme en medio ya se ve
      // aqui y la anulacion se rechaza en lugar de dejar un pago en una compra
      // anulada.
      await lockPurchaseRow(tx, purchaseId);

      const purchase = await tx.compra.findUnique({
        where: {
          id_compra: purchaseId,
        },
        include: {
          pago_proveedor: {
            select: {
              id_pago_proveedor: true,
            },
          },
          movimiento_inventario: {
            where: {
              tipo_movimiento: "entrada",
            },
          },
        },
      });

      if (!purchase) {
        throw new PurchaseAnnulmentRejectedError("La compra seleccionada no existe.");
      }

      if (purchase.estado_compra === "anulada") {
        throw new PurchaseAnnulmentRejectedError(ALREADY_ANNULLED);
      }

      if (purchase.pago_proveedor.length > 0) {
        throw new PurchaseAnnulmentRejectedError(
          "No se puede anular una compra con pagos registrados.",
        );
      }

      const reversalIds = await getNextCorrelativeIds(tx, {
        codigoEntidad: "movimiento_inventario",
        prefijo: "MVI",
        cantidad: purchase.movimiento_inventario.length,
      });

      // La condicion y la escritura van en la misma sentencia. Con la fila bloqueada
      // ya no puede cambiar entre la lectura y aqui; se conserva como segunda
      // defensa: si cambiara, count es 0 y el stock no se revierte dos veces.
      const annulment = await tx.compra.updateMany({
        where: {
          id_compra: purchaseId,
          estado_compra: {
            not: "anulada",
          },
        },
        data: {
          estado_compra: "anulada",
          estado_pago: "anulada",
        },
      });

      if (annulment.count !== 1) {
        throw new PurchaseAnnulmentRejectedError(ALREADY_ANNULLED);
      }

      for (const [index, movement] of purchase.movimiento_inventario.entries()) {
        // La validacion de stock suficiente y la resta van en la misma sentencia: una
        // salida que confirme en medio no puede dejar el stock por debajo de lo que se
        // revierte. Si no alcanza, se aborta la anulacion completa.
        const [updatedMaterial] = await tx.material.updateManyAndReturn({
          where: {
            id_material: movement.id_material,
            stock_actual: {
              gte: movement.cantidad,
            },
          },
          data: {
            stock_actual: {
              decrement: movement.cantidad,
            },
          },
          select: {
            stock_actual: true,
          },
        });

        if (!updatedMaterial) {
          throw new PurchaseAnnulmentRejectedError(
            "No hay stock suficiente para revertir la compra: parte de lo que ingresó ya salió del inventario.",
          );
        }

        const stockResultante = updatedMaterial.stock_actual;
        const stockAnterior = stockResultante.plus(movement.cantidad);

        await tx.movimiento_inventario.create({
          data: {
            id_movimiento: reversalIds[index],
            id_material: movement.id_material,
            id_compra: purchaseId,
            tipo_movimiento: "salida",
            cantidad: movement.cantidad,
            stock_anterior: stockAnterior,
            stock_resultante: stockResultante,
            motivo: `Reversion por anulacion de compra ${purchaseId}`,
            id_usuario_responsable: session.user.id,
          },
        });
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "compra",
        id_registro_afectado: purchaseId,
        accion: "anular",
        detalle: `Compra anulada con reversion de inventario: ${purchaseId}`,
        tx,
      });
    });
  } catch (error) {
    if (error instanceof PurchaseAnnulmentRejectedError) {
      return rowStatusError(purchaseId, error.message);
    }

    throw error;
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/materials");
  revalidatePath("/dashboard/inventory/purchases");
  revalidatePath(`/dashboard/inventory/purchases/${purchaseId}`);

  return rowStatusDone(purchaseId, "anulada");
}
