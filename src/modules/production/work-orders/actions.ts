"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { workOrderSchema } from "@/schemas/production/work-order.schema";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));

  if (Number.isNaN(currentNumber)) {
    return `${prefix}00000001`;
  }

  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function requireProductionManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function parseNullableDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`);
}

export async function createWorkOrderAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = workOrderSchema.safeParse({
    tipo_produccion: formData.get("tipo_produccion"),
    id_detalle_pedido: formData.get("id_detalle_pedido") ?? "",
    id_campania: formData.get("id_campania") ?? "",
    id_producto: formData.get("id_producto"),
    id_ruta: formData.get("id_ruta"),
    id_version_receta: formData.get("id_version_receta"),
    cantidad: formData.get("cantidad"),
    fecha_inicio: formData.get("fecha_inicio"),
    fecha_entrega_estimada: formData.get("fecha_entrega_estimada") ?? "",
    prioridad: formData.get("prioridad"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const product = await prisma.producto.findFirst({
    where: {
      id_producto: data.id_producto,
      estado: true,
    },
    select: {
      id_producto: true,
      nombre_producto: true,
    },
  });

  if (!product) {
    throw new Error("El producto seleccionado no existe o está inactivo.");
  }

  const route = await prisma.ruta_fabricacion.findFirst({
    where: {
      id_ruta: data.id_ruta,
      id_producto: data.id_producto,
      estado: true,
    },
    include: {
      etapa_ruta: {
        where: {
          estado: true,
        },
      },
    },
  });

  if (!route) {
    throw new Error(
      "La ruta seleccionada no existe, está inactiva o no pertenece al producto.",
    );
  }

  if (route.etapa_ruta.length === 0) {
    throw new Error(
      "La ruta seleccionada no tiene etapas activas. Registre etapas antes de crear la orden.",
    );
  }

  const version = await prisma.version_receta.findFirst({
    where: {
      id_version_receta: data.id_version_receta,
      estado: "vigente",
      receta_tecnica: {
        id_producto: data.id_producto,
        estado: "activa",
      },
    },
    include: {
      receta_tecnica: true,
      detalle_receta: true,
    },
  });

  if (!version) {
    throw new Error(
      "La versión de receta seleccionada no existe, no está vigente o no pertenece al producto.",
    );
  }

  if (version.detalle_receta.length === 0) {
    throw new Error(
      "La versión de receta no tiene materiales registrados. Agregue materiales antes de crear la orden.",
    );
  }

  let idCliente: string | null = null;
  let idDetallePedido: string | null = null;

  if (data.tipo_produccion === "pedido") {
    const orderDetail = await prisma.detalle_pedido.findUnique({
      where: {
        id_detalle_pedido: data.id_detalle_pedido ?? "",
      },
      include: {
        pedido: true,
      },
    });

    if (!orderDetail) {
      throw new Error("El detalle de pedido seleccionado no existe.");
    }

    if (orderDetail.id_producto !== data.id_producto) {
      throw new Error(
        "El producto de la orden no coincide con el producto del detalle de pedido.",
      );
    }

    idCliente = orderDetail.pedido.id_cliente;
    idDetallePedido = orderDetail.id_detalle_pedido;
  }

  let idCampania: string | null = null;

  if (data.tipo_produccion === "campania") {
    const campaign = await prisma.campania_produccion.findFirst({
      where: {
        id_campania: data.id_campania ?? "",
        estado: {
          in: ["planificada", "activa"],
        },
      },
    });

    if (!campaign) {
      throw new Error("La campaña seleccionada no existe o no está activa.");
    }

    idCampania = campaign.id_campania;
  }

  const lastWorkOrder = await prisma.orden_trabajo.findFirst({
    orderBy: {
      id_orden_trabajo: "desc",
    },
    select: {
      id_orden_trabajo: true,
    },
  });

  const idOrdenTrabajo = buildSequentialId(
    lastWorkOrder?.id_orden_trabajo,
    "OTR",
  );

  await prisma.$transaction(async (tx) => {
    await tx.orden_trabajo.create({
      data: {
        id_orden_trabajo: idOrdenTrabajo,
        id_cliente: idCliente,
        id_producto: data.id_producto,
        id_campania: idCampania,
        id_detalle_pedido: idDetallePedido,
        id_ruta: data.id_ruta,
        id_version_receta: data.id_version_receta,
        tipo_produccion: data.tipo_produccion,
        cantidad: data.cantidad,
        fecha_inicio: parseDate(data.fecha_inicio),
        fecha_entrega_estimada: parseNullableDate(data.fecha_entrega_estimada),
        prioridad: data.prioridad,
        estado: "pendiente",
        observaciones: data.observaciones,
        id_usuario_registro: session.user.id,
      },
    });

    if (idDetallePedido) {
      const orderDetail = await tx.detalle_pedido.findUnique({
        where: {
          id_detalle_pedido: idDetallePedido,
        },
        select: {
          id_pedido: true,
        },
      });

      if (orderDetail) {
        await tx.pedido.update({
          where: {
            id_pedido: orderDetail.id_pedido,
          },
          data: {
            estado: "en producción",
          },
        });
      }
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");

  redirect(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
}