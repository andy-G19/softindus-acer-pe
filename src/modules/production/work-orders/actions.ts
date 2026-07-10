"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { workOrderSchema } from "@/schemas/production/work-order.schema";

function requireProductionManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
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

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numericValue = Number(value.toString());

  return Number.isNaN(numericValue) ? 0 : numericValue;
}

function roundQuantity(value: number) {
  return Number(value.toFixed(2));
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
      detalle_receta: true,
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
            estado: "en_produccion",
          },
        });
      }
    }

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "crear",
      detalle: `Orden de trabajo creada para el producto ${effectiveProductId}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");

  redirect(`/dashboard/production/work-orders/${idOrdenTrabajo}?toast=work-order-created`);
}

export async function consumeWorkOrderMaterialsAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const idOrdenTrabajo = String(
    formData.get("id_orden_trabajo") ?? "",
  ).trim();

  if (!idOrdenTrabajo) {
    throw new Error("No se recibio la orden de trabajo.");
  }

  const workOrder = await prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    include: {
      version_receta: {
        include: {
          detalle_receta: {
            include: {
              material: true,
            },
            orderBy: {
              id_detalle_receta: "asc",
            },
          },
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (workOrder.estado === "anulada" || workOrder.estado === "finalizada") {
    throw new Error(
      "No se puede consumir materiales de una orden anulada o finalizada.",
    );
  }

  if (!workOrder.id_version_receta || !workOrder.version_receta) {
    throw new Error("La orden de trabajo no tiene una receta tecnica asociada.");
  }

  if (workOrder.version_receta.detalle_receta.length === 0) {
    throw new Error("La receta tecnica asociada no tiene materiales.");
  }

  const existingConsumption = await prisma.movimiento_inventario.count({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
      tipo_movimiento: "salida",
    },
  });

  if (existingConsumption > 0) {
    throw new Error(
      "Los materiales de esta orden ya fueron consumidos. No se permite consumirlos nuevamente.",
    );
  }

  const orderQuantity = toNumber(workOrder.cantidad);

  if (orderQuantity <= 0) {
    throw new Error("La cantidad de la orden debe ser mayor que cero.");
  }

  const consumptions = workOrder.version_receta.detalle_receta.map((detail) => {
    const requiredBase = toNumber(detail.cantidad_requerida) * orderQuantity;
    const wastePercentage = toNumber(detail.merma_estimada_porcentaje);
    const requiredWithWaste = roundQuantity(
      requiredBase * (1 + wastePercentage / 100),
    );
    const stockActual = toNumber(detail.material.stock_actual);
    const stockMinimo = toNumber(detail.material.stock_minimo);
    const stockResultante = roundQuantity(stockActual - requiredWithWaste);

    return {
      idMaterial: detail.id_material,
      materialName: detail.material.nombre_material,
      materialIsActive: detail.material.estado,
      requiredWithWaste,
      stockActual,
      stockMinimo,
      stockResultante,
    };
  });

  const inactiveMaterials = consumptions.filter(
    (consumption) => !consumption.materialIsActive,
  );

  if (inactiveMaterials.length > 0) {
    throw new Error(
      `No se puede consumir materiales inactivos: ${inactiveMaterials
        .map((material) => material.materialName)
        .join(", ")}.`,
    );
  }

  const insufficientMaterials = consumptions.filter((consumption) => {
    return consumption.stockActual < consumption.requiredWithWaste;
  });

  if (insufficientMaterials.length > 0) {
    const detail = insufficientMaterials
      .map((material) => {
        return `${material.materialName} requiere ${material.requiredWithWaste.toFixed(
          2,
        )} y tiene ${material.stockActual.toFixed(2)}`;
      })
      .join("; ");

    throw new Error(`Stock insuficiente para consumir la orden: ${detail}.`);
  }

  const criticalConsumptions = consumptions.filter((consumption) => {
    return consumption.stockResultante <= consumption.stockMinimo;
  });

  const activeAlerts =
    criticalConsumptions.length > 0
      ? await prisma.alerta_stock.findMany({
          where: {
            id_material: {
              in: criticalConsumptions.map(
                (consumption) => consumption.idMaterial,
              ),
            },
            estado_alerta: "activa",
          },
          select: {
            id_alerta: true,
            id_material: true,
          },
        })
      : [];

  const activeAlertByMaterial = new Map(
    activeAlerts.map((alert) => [alert.id_material, alert.id_alerta]),
  );

  const criticalConsumptionsWithoutAlert = criticalConsumptions.filter(
    (consumption) => !activeAlertByMaterial.has(consumption.idMaterial),
  );

  await prisma.$transaction(async (tx) => {
    const movementIds = await getNextCorrelativeIds(tx, {
      codigoEntidad: "movimiento_inventario",
      prefijo: "MVI",
      cantidad: consumptions.length,
    });
    const alertIds = await getNextCorrelativeIds(tx, {
      codigoEntidad: "alerta_stock",
      prefijo: "ALE",
      cantidad: criticalConsumptionsWithoutAlert.length,
    });
    const alertIdByMaterial = new Map(
      criticalConsumptionsWithoutAlert.map((consumption, index) => [
        consumption.idMaterial,
        alertIds[index],
      ]),
    );

    const consumptionInsideTransaction = await tx.movimiento_inventario.count({
      where: {
        id_orden_trabajo: idOrdenTrabajo,
        tipo_movimiento: "salida",
      },
    });

    if (consumptionInsideTransaction > 0) {
      throw new Error(
        "Los materiales de esta orden ya fueron consumidos. No se permite consumirlos nuevamente.",
      );
    }

    for (const [index, consumption] of consumptions.entries()) {
      const materialUpdate = await tx.material.updateMany({
        where: {
          id_material: consumption.idMaterial,
          stock_actual: {
            gte: consumption.requiredWithWaste,
          },
        },
        data: {
          stock_actual: {
            decrement: consumption.requiredWithWaste,
          },
        },
      });

      if (materialUpdate.count !== 1) {
        throw new Error(
          `Stock insuficiente para ${consumption.materialName}. La operacion fue cancelada.`,
        );
      }

      await tx.movimiento_inventario.create({
        data: {
          id_movimiento: movementIds[index],
          id_material: consumption.idMaterial,
          id_orden_trabajo: idOrdenTrabajo,
          tipo_movimiento: "salida",
          cantidad: consumption.requiredWithWaste,
          stock_anterior: consumption.stockActual,
          stock_resultante: consumption.stockResultante,
          motivo: `Salida por consumo de orden de trabajo ${idOrdenTrabajo}`,
          id_usuario_responsable: session.user.id,
        },
      });

      if (consumption.stockResultante <= consumption.stockMinimo) {
        const activeAlertId = activeAlertByMaterial.get(
          consumption.idMaterial,
        );

        if (activeAlertId) {
          await tx.alerta_stock.update({
            where: {
              id_alerta: activeAlertId,
            },
            data: {
              stock_detectado: consumption.stockResultante,
              stock_minimo: consumption.stockMinimo,
              mensaje: `El material ${consumption.materialName} quedo en stock critico tras consumir la orden ${idOrdenTrabajo}.`,
            },
          });
        } else {
          const newAlertId = alertIdByMaterial.get(consumption.idMaterial);

          if (!newAlertId) {
            throw new Error(
              `No se pudo generar la alerta de stock para ${consumption.materialName}.`,
            );
          }

          await tx.alerta_stock.create({
            data: {
              id_alerta: newAlertId,
              id_material: consumption.idMaterial,
              stock_detectado: consumption.stockResultante,
              stock_minimo: consumption.stockMinimo,
              estado_alerta: "activa",
              mensaje: `El material ${consumption.materialName} quedo en stock critico tras consumir la orden ${idOrdenTrabajo}.`,
            },
          });
        }
      }
    }

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "consumir_materiales",
      detalle: `Consumo de materiales registrado para ${consumptions.length} material(es).`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/alerts");
  revalidatePath("/dashboard/inventory/materials");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}?toast=work-order-materials-consumed`,
  );
}

export async function annulWorkOrderAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "");

  if (!idOrdenTrabajo) {
    throw new Error("No se recibio la orden de trabajo.");
  }

  const workOrder = await prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    select: {
      id_orden_trabajo: true,
      estado: true,
      movimiento_inventario: {
        select: {
          id_movimiento: true,
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (workOrder.estado === "anulada") {
    throw new Error("La orden de trabajo ya esta anulada.");
  }

  if (workOrder.estado === "finalizada") {
    throw new Error("No se puede anular una orden finalizada desde el listado.");
  }

  if (workOrder.movimiento_inventario.length > 0) {
    throw new Error(
      "No se puede anular una orden con consumos registrados sin reversar inventario.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.orden_trabajo.update({
      where: {
        id_orden_trabajo: idOrdenTrabajo,
      },
      data: {
        estado: "anulada",
        fecha_entrega_real: null,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "anular",
      detalle: `Orden de trabajo anulada: ${idOrdenTrabajo}`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);

  redirect("/dashboard/production/work-orders?toast=work-order-annulled");
}

export async function finishWorkOrderAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "");

  if (!idOrdenTrabajo) {
    throw new Error("No se recibio la orden de trabajo.");
  }

  const workOrder = await prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    include: {
      avance_orden: {
        select: {
          estado_etapa: true,
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (workOrder.estado === "anulada") {
    throw new Error("No se puede finalizar una orden anulada.");
  }

  if (workOrder.estado === "finalizada") {
    redirect(`/dashboard/production/work-orders/${idOrdenTrabajo}`);
  }

  if (workOrder.avance_orden.length === 0) {
    throw new Error("La orden no tiene avances generados.");
  }

  const allStagesFinished = workOrder.avance_orden.every(
    (advance) => advance.estado_etapa === "terminada",
  );

  if (!allStagesFinished) {
    throw new Error(
      "Solo se puede finalizar una orden cuando todas sus etapas estan terminadas.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.orden_trabajo.update({
      where: {
        id_orden_trabajo: idOrdenTrabajo,
      },
      data: {
        estado: "finalizada",
        fecha_entrega_real: new Date(),
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "finalizar",
      detalle: `Orden de trabajo finalizada: ${idOrdenTrabajo}`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);

  redirect(`/dashboard/production/work-orders/${idOrdenTrabajo}?toast=work-order-finished`);
}
