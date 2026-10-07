import "server-only";

import { registerAuditLog } from "@/lib/audit";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { calculateRequiredQuantityRounded } from "@/lib/recipe-quantities";
import type { WorkOrderInput } from "@/schemas/production/work-order.schema";

/**
 * Creacion de una orden de trabajo.
 *
 * Caso de uso, no server action (ver work-order-status.ts): recibe los datos ya
 * validados por el esquema y el usuario ya verificado. Comprueba el producto, la ruta,
 * la version de receta y el origen (pedido, campania o reposicion), y en una sola
 * transaccion reserva los correlativos, crea la orden, pasa el pedido a produccion y
 * congela el requerimiento de materiales.
 */
export type CreateWorkOrderParams = {
  data: WorkOrderInput;
  idUsuario: string;
};

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function parseNullableDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`);
}

/** Crea la orden y devuelve su id. */
export async function createWorkOrder({
  data,
  idUsuario,
}: CreateWorkOrderParams) {
  let effectiveProductId = data.id_producto ?? "";

  if (data.tipo_produccion === "pedido") {
    if (!data.id_detalle_pedido) {
      throw new Error("Para una orden por pedido debe seleccionar un detalle de pedido.");
    }

    const orderDetail = await prisma.detalle_pedido.findUnique({
      where: {
        id_detalle_pedido: data.id_detalle_pedido,
      },
      select: {
        id_producto: true,
      },
    });

    if (!orderDetail) {
      throw new Error("El detalle de pedido seleccionado no existe.");
    }

    if (data.id_producto && orderDetail.id_producto !== data.id_producto) {
      throw new Error("El detalle de pedido pertenece a otro producto.");
    }

    effectiveProductId = orderDetail.id_producto;
  }

  if (
    (data.tipo_produccion === "campania" ||
      data.tipo_produccion === "reposicion_stock") &&
    !data.id_producto
  ) {
    throw new Error("Seleccione un producto.");
  }

  const product = await prisma.producto.findFirst({
    where: {
      id_producto: effectiveProductId,
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

  if (route.id_producto !== effectiveProductId) {
    throw new Error("La ruta seleccionada pertenece a otro producto.");
  }

  if (route.etapa_ruta.length === 0) {
    throw new Error(
      "La ruta seleccionada no tiene etapas activas. Registre etapas antes de crear la orden.",
    );
  }

  const version = await prisma.version_receta.findFirst({
    where: {
      id_version_receta: data.id_version_receta,
    },
    include: {
      receta_tecnica: true,
      detalle_receta: {
        // El material se incluye por su costo_unitario_actual: es el dato que se congela
        // en el snapshot y no se puede reconstruir despues.
        include: {
          material: {
            select: {
              id_material: true,
              costo_unitario_actual: true,
            },
          },
        },
        orderBy: {
          id_detalle_receta: "asc",
        },
      },
    },
  });

  if (!version) {
    throw new Error(
      "La versión de receta seleccionada no existe, no está vigente o no pertenece al producto.",
    );
  }

  if (
    version.estado !== "vigente" ||
    version.receta_tecnica.estado !== "activa"
  ) {
    throw new Error("La receta seleccionada no esta vigente o activa.");
  }

  if (version.receta_tecnica.id_producto !== effectiveProductId) {
    throw new Error("La receta seleccionada pertenece a otro producto.");
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

    if (data.id_producto && orderDetail.id_producto !== data.id_producto) {
      throw new Error("El detalle de pedido pertenece a otro producto.");
    }

    idCliente = orderDetail.pedido.id_cliente;
    idDetallePedido = orderDetail.id_detalle_pedido;
  }

  let idCampania: string | null = null;

  if (data.tipo_produccion === "campania") {
    if (!data.id_campania) {
      throw new Error("Para una orden por campania debe seleccionar una campania.");
    }

    const campaign = await prisma.campania_produccion.findFirst({
      where: {
        id_campania: data.id_campania,
        estado: {
          in: ["planificada", "activa"],
        },
      },
      include: {
        campania_detalle: {
          select: {
            id_producto: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new Error("La campaña seleccionada no existe o no está activa.");
    }

    idCampania = campaign.id_campania;

    if (
      campaign.campania_detalle.length > 0 &&
      !campaign.campania_detalle.some((detail) => {
        return detail.id_producto === effectiveProductId;
      })
    ) {
      throw new Error("El producto seleccionado no pertenece a la campania.");
    }
  }

  let idOrdenTrabajo = "";

  await prisma.$transaction(async (tx) => {
    idOrdenTrabajo = await getNextCorrelativeId(tx, {
      codigoEntidad: "orden_trabajo",
      prefijo: "OTR",
    });

    await tx.orden_trabajo.create({
      data: {
        id_orden_trabajo: idOrdenTrabajo,
        id_cliente: idCliente,
        id_producto: effectiveProductId,
        id_campania: idCampania,
        id_detalle_pedido: idDetallePedido,
        id_ruta: data.id_ruta,
        id_version_receta: version.id_version_receta,
        tipo_produccion: data.tipo_produccion,
        cantidad: data.cantidad,
        fecha_inicio: parseDate(data.fecha_inicio),
        fecha_entrega_estimada: parseNullableDate(data.fecha_entrega_estimada),
        prioridad: data.prioridad,
        estado: "pendiente",
        observaciones: data.observaciones,
        id_usuario_registro: idUsuario,
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
            estado: "en_produccion",
          },
        });
      }
    }

    // Snapshot del requerimiento: se congela dentro de la MISMA transaccion que crea la
    // orden, para que no pueda existir una orden sin su requerimiento.
    const requirementIds = await getNextCorrelativeIds(tx, {
      codigoEntidad: "requerimiento_orden_material",
      prefijo: "ROM",
      cantidad: version.detalle_receta.length,
    });

    await tx.requerimiento_orden_material.createMany({
      data: version.detalle_receta.map((detail, index) => ({
        id_requerimiento: requirementIds[index],
        id_orden_trabajo: idOrdenTrabajo,
        id_material: detail.id_material,
        cantidad_por_unidad: detail.cantidad_requerida,
        merma_estimada_porcentaje: detail.merma_estimada_porcentaje,
        unidad_medida: detail.unidad_medida,
        tipo_consumo: detail.tipo_consumo,
        costo_unitario_registrado: detail.material.costo_unitario_actual,
        cantidad_requerida: calculateRequiredQuantityRounded({
          quantityPerUnit: detail.cantidad_requerida,
          wastePercentage: detail.merma_estimada_porcentaje,
          orderQuantity: data.cantidad,
        }),
      })),
    });

    await registerAuditLog({
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "crear",
      detalle: `Orden de trabajo creada para el producto ${effectiveProductId}. Requerimiento congelado: ${version.detalle_receta.length} material(es).`,
      tx,
    });
  });

  return idOrdenTrabajo;
}
