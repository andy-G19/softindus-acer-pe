"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId, buildNextIds } from "@/lib/ids";
import { orderSchema } from "@/schemas/commercial/order.schema";

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

export async function createOrderAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

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

  const items = productIds
    .map((id_producto, index) => ({
      id_producto,
      cantidad: quantities[index],
      precio_unitario: unitPrices[index],
      observaciones: itemObservations[index] ?? "",
    }))
    .filter((item) => item.id_producto);

  const rawData = {
    id_cliente: formData.get("id_cliente")?.toString(),
    fecha_entrega_estimada:
      formData.get("fecha_entrega_estimada")?.toString() || undefined,
    observaciones: formData.get("observaciones")?.toString() ?? "",
    items,
  };

  const parsed = orderSchema.safeParse(rawData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const repeatedProducts = parsed.data.items
    .map((item) => item.id_producto)
    .filter((id_producto, index, array) => array.indexOf(id_producto) !== index);

  if (repeatedProducts.length > 0) {
    throw new Error("No repitas el mismo producto dentro del pedido.");
  }

  const montoEstimado = parsed.data.items.reduce((total, item) => {
    return total + item.cantidad * item.precio_unitario;
  }, 0);

  const lastOrder = await prisma.pedido.findFirst({
    orderBy: {
      id_pedido: "desc",
    },
    select: {
      id_pedido: true,
    },
  });

  const lastOrderDetail = await prisma.detalle_pedido.findFirst({
    orderBy: {
      id_detalle_pedido: "desc",
    },
    select: {
      id_detalle_pedido: true,
    },
  });

  const id_pedido = buildNextId("PED", lastOrder?.id_pedido);

  const detailIds = buildNextIds(
    "DPE",
    lastOrderDetail?.id_detalle_pedido,
    parsed.data.items.length
  );

  await prisma.$transaction(async (tx) => {
    await tx.pedido.create({
      data: {
        id_pedido,
        id_cliente: parsed.data.id_cliente,
        id_usuario_registro: session.user.id,
        fecha_pedido: new Date(),
        fecha_entrega_estimada: toDateOrNull(
          parsed.data.fecha_entrega_estimada
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
      detalle: `Pedido creado con ${parsed.data.items.length} producto(s).`,
      tx,
    });
  });

  revalidatePath("/dashboard/commercial/orders");
  redirect("/dashboard/commercial/orders");
}
