"use server";

import { revalidatePath } from "next/cache";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { FieldErrors } from "@/lib/errors";
import { calculateOrderAmounts } from "@/lib/order-amounts";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockOrderRow } from "@/lib/row-locks";
import { getOrderChangeBlock } from "@/modules/commercial/orders/order-rules";
import { orderSchema, type OrderInput } from "@/schemas/commercial/order.schema";

/** Una linea del pedido tal como se envio. */
export type OrderLineValues = {
  id_producto: string;
  cantidad: string;
  precio_unitario: string;
  observacion_detalle: string;
};

/** Lo que el formulario de pedido envio, tal cual, para volver a mostrarlo. */
export type OrderFormValues = {
  id_cliente: string;
  fecha_entrega_estimada: string;
  observaciones: string;
  items: OrderLineValues[];
};

// Entrega 10.4c: el alta y la edicion de pedidos no redirigen; devuelven el
// resultado y el formulario da el aviso y vuelve al listado. Sin permiso
// responden con un error, no redirigen. Los errores de una linea van con la
// clave items.<linea>.<campo> (o items.<linea> si son de la linea entera), con
// la posicion de la linea en el formulario.
export type OrderFormState = FormActionState<OrderFormValues, { id_pedido: string }>;

const ORDERS_PATH = "/dashboard/commercial/orders";
const REPEATED_PRODUCT = "No repitas el mismo producto dentro del pedido.";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text ? text : null;
}

function toDateOrNull(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`);
}

function getOrderFormValues(formData: FormData): OrderFormValues {
  const all = (name: string) => formData.getAll(name).map((value) => value.toString());
  const quantities = all("cantidad");
  const unitPrices = all("precio_unitario");
  const observations = all("observacion_detalle");

  return {
    id_cliente: formData.get("id_cliente")?.toString() ?? "",
    fecha_entrega_estimada: formData.get("fecha_entrega_estimada")?.toString() ?? "",
    observaciones: formData.get("observaciones")?.toString() ?? "",
    items: all("id_producto").map((id_producto, index) => ({
      id_producto,
      cantidad: quantities[index] ?? "",
      precio_unitario: unitPrices[index] ?? "",
      observacion_detalle: observations[index] ?? "",
    })),
  };
}

function orderError(values: OrderFormValues, error: string, fieldErrors?: FieldErrors): OrderFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function orderSaved(values: OrderFormValues, idPedido: string): OrderFormState {
  return { status: "success", data: { id_pedido: idPedido }, values, operationId: newOperationId() };
}

function getOrderItems(formData: FormData) {
  const productIds = formData
    .getAll("id_producto")
    .map((value) => value.toString().trim());
  const quantities = formData
    .getAll("cantidad")
    .map((value) => value.toString().trim());
  const unitPrices = formData
    .getAll("precio_unitario")
    .map((value) => value.toString().trim());
  const itemObservations = formData
    .getAll("observacion_detalle")
    .map((value) => value.toString().trim());

  return productIds
    .map((id_producto, index) => ({
      id_producto,
      cantidad: quantities[index],
      precio_unitario: unitPrices[index],
      observaciones: itemObservations[index] ?? "",
      line: index,
    }))
    .filter((item) => item.id_producto);
}

// Las lineas sin producto se descartan: lines dice en que posicion del
// formulario esta cada linea que se valida, para dar el error en su linea.
function getOrderFormData(formData: FormData) {
  const items = getOrderItems(formData);

  return {
    data: {
      id_cliente: formData.get("id_cliente")?.toString(),
      fecha_entrega_estimada:
        formData.get("fecha_entrega_estimada")?.toString() || undefined,
      observaciones: formData.get("observaciones")?.toString() ?? "",
      items: items.map(({ line: _line, ...item }) => item),
    },
    lines: items.map((item) => item.line),
  };
}

function lineKey(lines: number[], index: number, field?: string) {
  return `items.${lines[index]}${field ? `.${field}` : ""}`;
}

function addFieldError(errors: FieldErrors, key: string, message: string) {
  errors[key] = [...(errors[key] ?? []), message];
}

// Errores de Zod por campo: los de una linea, con la clave de su linea.
function schemaFieldErrors(issues: { path: PropertyKey[]; message: string }[], lines: number[]) {
  const errors: FieldErrors = {};

  for (const issue of issues) {
    const [first, index, field] = issue.path;
    const key =
      first === "items" && typeof index === "number"
        ? lineKey(lines, index, field === undefined ? undefined : String(field))
        : String(first);

    addFieldError(errors, key, issue.message);
  }

  return errors;
}

// Posiciones (en items) de un producto que ya aparecio en una linea anterior.
function findRepeatedProducts(items: { id_producto: string }[]) {
  return items
    .map((item, index) => ({ id_producto: item.id_producto, index }))
    .filter(({ id_producto }, index, array) => array.findIndex((other) => other.id_producto === id_producto) !== index)
    .map(({ index }) => index);
}

function validateEstimatedDate(
  fechaEntrega: string | undefined,
  fechaPedido: Date,
) {
  if (!fechaEntrega) {
    return true;
  }

  const deliveryDate = toDateOrNull(fechaEntrega);

  if (!deliveryDate) {
    return true;
  }

  const orderDate = new Date(fechaPedido);
  orderDate.setHours(0, 0, 0, 0);

  return deliveryDate >= orderDate;
}

// El cliente y los productos deben existir y estar activos. Al editar
// (current), el cliente y los productos que el pedido ya tiene se aceptan
// aunque esten inactivos mientras no se cambien: la edicion los ofrece (D3 y
// hallazgo 5 de la 10.4a). Sin esta comprobacion, un id que no existe rompia en
// la clave foranea.
type OrderReader = Pick<Prisma.TransactionClient, "pedido" | "cliente" | "producto">;

async function validateActiveReferences(
  db: OrderReader,
  data: OrderInput,
  lines: number[],
  current?: { id_cliente: string; productIds: string[] },
): Promise<{ error: string; fieldErrors: FieldErrors } | null> {
  const productIds = data.items.map((item) => item.id_producto);
  const [client, products] = await Promise.all([
    db.cliente.findUnique({
      where: { id_cliente: data.id_cliente },
      select: { id_cliente: true, estado: true },
    }),
    db.producto.findMany({
      where: { id_producto: { in: productIds } },
      select: { id_producto: true, estado: true },
    }),
  ]);

  if (!client || (!client.estado && client.id_cliente !== current?.id_cliente)) {
    const message = "El cliente seleccionado no existe o está inactivo.";

    return { error: message, fieldErrors: { id_cliente: [message] } };
  }

  const usable = new Set(
    products
      .filter((product) => product.estado || current?.productIds.includes(product.id_producto))
      .map((product) => product.id_producto),
  );
  const fieldErrors: FieldErrors = {};

  productIds.forEach((id, index) => {
    if (!usable.has(id)) {
      addFieldError(fieldErrors, lineKey(lines, index, "id_producto"), "El producto seleccionado no existe o está inactivo.");
    }
  });

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Un producto seleccionado no existe o está inactivo.", fieldErrors };
  }

  return null;
}

async function validateOrderCanChange(db: OrderReader, orderId: string) {
  const order = await db.pedido.findUnique({
    where: {
      id_pedido: orderId,
    },
    include: {
      proforma: {
        select: {
          id_proforma: true,
          estado: true,
        },
      },
      comprobante_venta: {
        select: {
          id_comprobante: true,
          estado: true,
        },
      },
      detalle_pedido: {
        include: {
          orden_trabajo: {
            select: {
              id_orden_trabajo: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return { ok: false as const, message: "El pedido no existe." };
  }

  // C3 de la 11.3b (D30): la misma regla que el listado y la pagina de edicion.
  const block = getOrderChangeBlock(order);

  if (block) {
    return { ok: false as const, message: block };
  }

  return { ok: true as const, order };
}

// Reglas comunes del alta y la edicion (en la edicion, despues de leer el
// pedido): esquema, fecha de entrega, productos repetidos y referencias
// activas. Devuelve los datos validados o el estado de error.
async function validateOrder(
  db: OrderReader,
  formData: FormData,
  values: OrderFormValues,
  orderDate: Date,
  current?: { id_cliente: string; productIds: string[] },
) {
  const { data, lines } = getOrderFormData(formData);
  const parsed = orderSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false as const,
      state: orderError(values, "Revisa los datos del pedido.", schemaFieldErrors(parsed.error.issues, lines)),
    };
  }

  if (!validateEstimatedDate(parsed.data.fecha_entrega_estimada, orderDate)) {
    const message = "La fecha estimada de entrega no puede ser anterior a la fecha del pedido.";

    return { ok: false as const, state: orderError(values, message, { fecha_entrega_estimada: [message] }) };
  }

  const repeated = findRepeatedProducts(parsed.data.items);

  if (repeated.length > 0) {
    const fieldErrors: FieldErrors = {};

    for (const index of repeated) {
      addFieldError(fieldErrors, lineKey(lines, index, "id_producto"), REPEATED_PRODUCT);
    }

    return { ok: false as const, state: orderError(values, REPEATED_PRODUCT, fieldErrors) };
  }

  const referencesError = await validateActiveReferences(db, parsed.data, lines, current);

  if (referencesError) {
    return { ok: false as const, state: orderError(values, referencesError.error, referencesError.fieldErrors) };
  }

  return { ok: true as const, data: parsed.data };
}

export async function createOrderAction(
  _prevState: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const values = getOrderFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "SELLER"]);

  if (!session) {
    return orderError(values, "No tienes permisos para registrar pedidos.");
  }

  const validation = await validateOrder(prisma, formData, values, new Date());

  if (!validation.ok) {
    return validation.state;
  }

  const data = validation.data;
  const amounts = calculateOrderAmounts(data.items);
  let idPedido = "";

  await prisma.$transaction(async (tx) => {
    const id_pedido = await getNextCorrelativeId(tx, {
      codigoEntidad: "pedido",
      prefijo: "PED",
    });
    const detailIds = await getNextCorrelativeIds(tx, {
      codigoEntidad: "detalle_pedido",
      prefijo: "DPE",
      cantidad: data.items.length,
    });

    idPedido = id_pedido;

    await tx.pedido.create({
      data: {
        id_pedido,
        id_cliente: data.id_cliente,
        id_usuario_registro: session.user.id,
        fecha_pedido: new Date(),
        fecha_entrega_estimada: toDateOrNull(data.fecha_entrega_estimada),
        estado: "registrado",
        monto_estimado: amounts.total,
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });

    await tx.detalle_pedido.createMany({
      data: data.items.map((item, index) => ({
        id_detalle_pedido: detailIds[index],
        id_pedido,
        id_producto: item.id_producto,
        cantidad: amounts.lines[index].cantidad,
        precio_unitario: amounts.lines[index].precio_unitario,
        subtotal: amounts.lines[index].subtotal,
        observaciones: item.observaciones?.trim() || null,
      })),
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "pedido",
      id_registro_afectado: id_pedido,
      accion: "crear",
      detalle: `Pedido creado: ${id_pedido}`,
      tx,
    });
  });

  revalidatePath(ORDERS_PATH);

  return orderSaved(values, idPedido);
}

export async function updateOrderAction(
  _prevState: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const values = getOrderFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "SELLER"]);

  if (!session) {
    return orderError(values, "No tienes permisos para actualizar pedidos.");
  }

  const orderId = formData.get("id_pedido")?.toString().trim();

  if (!orderId) {
    return orderError(values, "El pedido no existe.");
  }

  // C4 de la 11.3b (D31, hallazgo 7 de la 10.4a): el pedido se bloquea dentro de la transaccion
  // y se lee despues, con el cliente y los productos: una proforma creada en medio (que bloquea el
  // mismo pedido) ya se ve aqui. Sin clave de operacion, un rechazo se devuelve desde la
  // transaccion antes de escribir nada.
  const rejection = await prisma.$transaction(async (tx) => {
    await lockOrderRow(tx, orderId);

    const changeValidation = await validateOrderCanChange(tx, orderId);

    if (!changeValidation.ok) {
      return orderError(values, changeValidation.message);
    }

    const validation = await validateOrder(tx, formData, values, changeValidation.order.fecha_pedido, {
      id_cliente: changeValidation.order.id_cliente,
      productIds: changeValidation.order.detalle_pedido.map((detail) => detail.id_producto),
    });

    if (!validation.ok) {
      return validation.state;
    }

    const data = validation.data;
    const amounts = calculateOrderAmounts(data.items);

    await tx.detalle_pedido.deleteMany({
      where: {
        id_pedido: orderId,
      },
    });

    const detailIds = await getNextCorrelativeIds(tx, {
      codigoEntidad: "detalle_pedido",
      prefijo: "DPE",
      cantidad: data.items.length,
    });

    await tx.pedido.update({
      where: {
        id_pedido: orderId,
      },
      data: {
        id_cliente: data.id_cliente,
        fecha_entrega_estimada: toDateOrNull(data.fecha_entrega_estimada),
        monto_estimado: amounts.total,
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });

    await tx.detalle_pedido.createMany({
      data: data.items.map((item, index) => ({
        id_detalle_pedido: detailIds[index],
        id_pedido: orderId,
        id_producto: item.id_producto,
        cantidad: amounts.lines[index].cantidad,
        precio_unitario: amounts.lines[index].precio_unitario,
        subtotal: amounts.lines[index].subtotal,
        observaciones: item.observaciones?.trim() || null,
      })),
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "pedido",
      id_registro_afectado: orderId,
      accion: "actualizar",
      detalle: `Pedido actualizado: ${orderId}`,
      tx,
    });

    return null;
  });

  if (rejection) {
    return rejection;
  }

  revalidatePath(ORDERS_PATH);
  revalidatePath(`${ORDERS_PATH}/${orderId}`);

  return orderSaved(values, orderId);
}

// C8 de la 11.3b (D34): cancelar se confirma con ConfirmActionButton y la accion devuelve
// RowStatusState. Antes volvia al listado sin decir por que no cancelaba (era la accion que la
// entrega 10 dejo redirigiendo, «whose cancel action stays for delivery 11»). Decide con el
// pedido bloqueado (C4) y la regla comun de order-rules.ts (C3).
export async function cancelOrderAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const orderId = formData.get("id_pedido")?.toString().trim() ?? "";

  const session = await getAuthorizedSession(["ADMIN", "SELLER"]);

  if (!session) {
    return rowStatusError(orderId, "No tienes permisos para cancelar pedidos.");
  }

  if (!orderId) {
    return rowStatusError(orderId, "Debe seleccionar un pedido válido.");
  }

  // C4 de la 11.3b (D31): el pedido se bloquea y se lee dentro de la transaccion, y la
  // cancelacion y su bitacora se escriben en ella. Un rechazo se devuelve antes de escribir.
  const rejection = await prisma.$transaction(async (tx) => {
    await lockOrderRow(tx, orderId);

    const changeValidation = await validateOrderCanChange(tx, orderId);

    if (!changeValidation.ok) {
      return changeValidation.message;
    }

    await tx.pedido.update({
      where: {
        id_pedido: orderId,
      },
      data: {
        estado: "cancelado",
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "pedido",
      id_registro_afectado: orderId,
      accion: "cancelar",
      detalle: `Pedido cancelado: ${orderId}`,
      tx,
    });

    return null;
  });

  // Un rechazo no revalida: el repintado se llevaria el boton y su mensaje (CLAUDE.md).
  if (rejection) {
    return rowStatusError(orderId, rejection);
  }

  revalidatePath(ORDERS_PATH);
  revalidatePath(`${ORDERS_PATH}/${orderId}`);

  return rowStatusDone(orderId, "cancelado");
}
