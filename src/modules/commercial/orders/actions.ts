"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId, buildNextIds } from "@/lib/ids";
import { orderSchema } from "@/schemas/commercial/order.schema";

export type OrderFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

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
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  return session;
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

  const montoEstimado = parsed.data.items.reduce((total, item) => {
    return total + item.cantidad * item.precio_unitario;
  }, 0);

  const [lastOrder, lastOrderDetail] = await Promise.all([
    prisma.pedido.findFirst({
      orderBy: {
        id_pedido: "desc",
      },
      select: {
        id_pedido: true,
      },
    }),
    prisma.detalle_pedido.findFirst({
      orderBy: {
        id_detalle_pedido: "desc",
      },
      select: {
        id_detalle_pedido: true,
      },
    }),
  ]);

  const id_pedido = buildNextId("PED", lastOrder?.id_pedido);
  const detailIds = buildNextIds(
    "DPE",
    lastOrderDetail?.id_detalle_pedido,
    parsed.data.items.length,
  );

  await prisma.$transaction(async (tx) => {
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
        monto_estimado: montoEstimado,
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });

    await tx.detalle_pedido.createMany({
      data: parsed.data.items.map((item, index) => ({
        id_detalle_pedido: detailIds[index],
        id_pedido,
        id_producto: item.id_producto,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.cantidad * item.precio_unitario,
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
  redirect(ORDERS_PATH);
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

  const montoEstimado = parsed.data.items.reduce((total, item) => {
    return total + item.cantidad * item.precio_unitario;
  }, 0);

  const lastOrderDetail = await prisma.detalle_pedido.findFirst({
    orderBy: {
      id_detalle_pedido: "desc",
    },
    select: {
      id_detalle_pedido: true,
    },
  });

  const detailIds = buildNextIds(
    "DPE",
    lastOrderDetail?.id_detalle_pedido,
    parsed.data.items.length,
  );

  await prisma.$transaction(async (tx) => {
    await tx.detalle_pedido.deleteMany({
      where: {
        id_pedido: orderId,
      },
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
        monto_estimado: montoEstimado,
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });

    await tx.detalle_pedido.createMany({
      data: parsed.data.items.map((item, index) => ({
        id_detalle_pedido: detailIds[index],
        id_pedido: orderId,
        id_producto: item.id_producto,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.cantidad * item.precio_unitario,
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
  redirect(ORDERS_PATH);
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
  redirect(ORDERS_PATH);
}
