"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { ActionErrorState } from "@/lib/errors";
import { calculateOrderAmounts } from "@/lib/order-amounts";
import { orderSchema, type OrderInput } from "@/schemas/commercial/order.schema";

export type OrderFormState = ActionErrorState;

const ORDERS_PATH = "/dashboard/commercial/orders";

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

async function requireCommercialPermission() {
  return requireRole(["ADMIN", "SELLER"]);
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
    }))
    .filter((item) => item.id_producto);
}

function getOrderFormData(formData: FormData) {
  return {
    id_cliente: formData.get("id_cliente")?.toString(),
    fecha_entrega_estimada:
      formData.get("fecha_entrega_estimada")?.toString() || undefined,
    observaciones: formData.get("observaciones")?.toString() ?? "",
    items: getOrderItems(formData),
  };
}

function validateRepeatedProducts(items: { id_producto: string }[]) {
  return items
    .map((item) => item.id_producto)
    .filter((id_producto, index, array) => array.indexOf(id_producto) !== index);
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
async function validateActiveReferences(
  data: OrderInput,
  current?: { id_cliente: string; productIds: string[] },
): Promise<OrderFormState | null> {
  const productIds = data.items.map((item) => item.id_producto);
  const [client, products] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id_cliente: data.id_cliente },
      select: { id_cliente: true, estado: true },
    }),
    prisma.producto.findMany({
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

  if (productIds.some((id) => !usable.has(id))) {
    const message = "Un producto seleccionado no existe o está inactivo.";

    return { error: message, fieldErrors: { items: [message] } };
  }

  return null;
}

async function validateOrderCanChange(orderId: string) {
  const order = await prisma.pedido.findUnique({
    where: {
      id_pedido: orderId,
    },
    include: {
      proforma: {
        select: {
          id_proforma: true,
        },
      },
      comprobante_venta: {
        select: {
          id_comprobante: true,
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

  if (order.estado === "cancelado" || order.estado === "anulado") {
    return {
      ok: false as const,
      message: "No se puede modificar un pedido cancelado.",
    };
  }

  const hasWorkOrders = order.detalle_pedido.some(
    (detail) => detail.orden_trabajo.length > 0,
  );

  if (
    order.proforma.length > 0 ||
    order.comprobante_venta.length > 0 ||
    hasWorkOrders
  ) {
    return {
      ok: false as const,
      message:
        "No se puede modificar un pedido con proforma, comprobante u orden asociada.",
    };
  }

  return { ok: true as const, order };
}

export async function createOrderAction(
  _prevState: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const session = await requireCommercialPermission();
  const parsed = orderSchema.safeParse(getOrderFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del pedido.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!validateEstimatedDate(parsed.data.fecha_entrega_estimada, new Date())) {
    return {
      error:
        "La fecha estimada de entrega no puede ser anterior a la fecha del pedido.",
      fieldErrors: {
        fecha_entrega_estimada: [
          "La fecha estimada de entrega no puede ser anterior a la fecha del pedido.",
        ],
      },
    };
  }

  if (validateRepeatedProducts(parsed.data.items).length > 0) {
    return {
      error: "No repitas el mismo producto dentro del pedido.",
      fieldErrors: {
        items: ["No repitas el mismo producto dentro del pedido."],
      },
    };
  }

  const referencesError = await validateActiveReferences(parsed.data);

  if (referencesError) {
    return referencesError;
  }

  const amounts = calculateOrderAmounts(parsed.data.items);

  await prisma.$transaction(async (tx) => {
    const id_pedido = await getNextCorrelativeId(tx, {
      codigoEntidad: "pedido",
      prefijo: "PED",
    });
    const detailIds = await getNextCorrelativeIds(tx, {
      codigoEntidad: "detalle_pedido",
      prefijo: "DPE",
      cantidad: parsed.data.items.length,
    });

    await tx.pedido.create({
      data: {
        id_pedido,
        id_cliente: parsed.data.id_cliente,
        id_usuario_registro: session.user.id,
        fecha_pedido: new Date(),
        fecha_entrega_estimada: toDateOrNull(
          parsed.data.fecha_entrega_estimada,
        ),
        estado: "registrado",
        monto_estimado: amounts.total,
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });

    await tx.detalle_pedido.createMany({
      data: parsed.data.items.map((item, index) => ({
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
  redirect(`${ORDERS_PATH}?toast=order-created`);
}

export async function updateOrderAction(
  _prevState: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const session = await requireCommercialPermission();
  const orderId = formData.get("id_pedido")?.toString().trim();

  if (!orderId) {
    return { error: "El pedido no existe." };
  }

  const changeValidation = await validateOrderCanChange(orderId);

  if (!changeValidation.ok) {
    return { error: changeValidation.message };
  }

  const parsed = orderSchema.safeParse(getOrderFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del pedido.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (
    !validateEstimatedDate(
      parsed.data.fecha_entrega_estimada,
      changeValidation.order.fecha_pedido,
    )
  ) {
    return {
      error:
        "La fecha estimada de entrega no puede ser anterior a la fecha del pedido.",
      fieldErrors: {
        fecha_entrega_estimada: [
          "La fecha estimada de entrega no puede ser anterior a la fecha del pedido.",
        ],
      },
    };
  }

  if (validateRepeatedProducts(parsed.data.items).length > 0) {
    return {
      error: "No repitas el mismo producto dentro del pedido.",
      fieldErrors: {
        items: ["No repitas el mismo producto dentro del pedido."],
      },
    };
  }

  const referencesError = await validateActiveReferences(parsed.data, {
    id_cliente: changeValidation.order.id_cliente,
    productIds: changeValidation.order.detalle_pedido.map((detail) => detail.id_producto),
  });

  if (referencesError) {
    return referencesError;
  }

  const amounts = calculateOrderAmounts(parsed.data.items);

  await prisma.$transaction(async (tx) => {
    await tx.detalle_pedido.deleteMany({
      where: {
        id_pedido: orderId,
      },
    });

    const detailIds = await getNextCorrelativeIds(tx, {
      codigoEntidad: "detalle_pedido",
      prefijo: "DPE",
      cantidad: parsed.data.items.length,
    });

    await tx.pedido.update({
      where: {
        id_pedido: orderId,
      },
      data: {
        id_cliente: parsed.data.id_cliente,
        fecha_entrega_estimada: toDateOrNull(
          parsed.data.fecha_entrega_estimada,
        ),
        monto_estimado: amounts.total,
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });

    await tx.detalle_pedido.createMany({
      data: parsed.data.items.map((item, index) => ({
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
  });

  revalidatePath(ORDERS_PATH);
  revalidatePath(`${ORDERS_PATH}/${orderId}`);
  redirect(`${ORDERS_PATH}?toast=order-updated`);
}

export async function cancelOrderAction(formData: FormData) {
  const session = await requireCommercialPermission();
  const orderId = formData.get("id_pedido")?.toString().trim();

  if (!orderId) {
    redirect(ORDERS_PATH);
  }

  const changeValidation = await validateOrderCanChange(orderId);

  if (!changeValidation.ok) {
    redirect(ORDERS_PATH);
  }

  await prisma.pedido.update({
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
  });

  revalidatePath(ORDERS_PATH);
  revalidatePath(`${ORDERS_PATH}/${orderId}`);
  redirect(`${ORDERS_PATH}?toast=order-cancelled`);
}
