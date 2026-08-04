"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import {
  calculatePendingDelivery,
  validateClosure,
} from "@/lib/material-reconciliation";
import { calculateRequiredQuantityRounded } from "@/lib/recipe-quantities";
import {
  deliverMaterials,
  returnMaterial,
} from "@/modules/production/work-orders/material-delivery";
import {
  additionalDeliverySchema,
  closeMaterialsSchema,
  materialReturnSchema,
  reopenMaterialsSchema,
} from "@/schemas/production/work-order-materials.schema";
import { workOrderSchema } from "@/schemas/production/work-order.schema";

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

export async function createWorkOrderAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "crear",
      detalle: `Orden de trabajo creada para el producto ${effectiveProductId}. Requerimiento congelado: ${version.detalle_receta.length} material(es).`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/work-orders");

  redirect(`/dashboard/production/work-orders/${idOrdenTrabajo}?toast=work-order-created`);
}

/**
 * Entrega al taller todo lo que falta del requerimiento congelado.
 *
 * Lee del snapshot y no de la receta: la orden ya fijo su plan al crearse, y una edicion
 * posterior de la receta no debe cambiar lo que se entrega.
 */
export async function deliverWorkOrderMaterialsAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "").trim();

  if (!idOrdenTrabajo) {
    throw new Error("No se recibio la orden de trabajo.");
  }

  const workOrder = await prisma.orden_trabajo.findUnique({
    where: { id_orden_trabajo: idOrdenTrabajo },
    include: {
      requerimiento_orden_material: {
        include: { material: true },
        orderBy: { id_requerimiento: "asc" },
      },
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (workOrder.estado === "anulada" || workOrder.estado === "finalizada") {
    throw new Error(
      "No se puede entregar material a una orden anulada o finalizada.",
    );
  }

  if (workOrder.fecha_cierre_materiales) {
    throw new Error(
      "Los materiales de esta orden ya fueron cerrados: no se puede mover mas material.",
    );
  }

  if (workOrder.requerimiento_orden_material.length === 0) {
    throw new Error(
      "Esta orden no tiene requerimiento congelado: se creo antes de que el sistema lo registrara. No es posible entregar material contra ella.",
    );
  }

  const lines = workOrder.requerimiento_orden_material
    .map((requirement) => {
      const pending = calculatePendingDelivery({
        required: requirement.cantidad_requerida,
        delivered: requirement.cantidad_entregada,
      });

      return {
        idRequerimiento: requirement.id_requerimiento,
        idMaterial: requirement.id_material,
        materialName: requirement.material.nombre_material,
        materialIsActive: requirement.material.estado,
        quantity: pending,
        stockActual: toNumber(requirement.material.stock_actual),
        stockMinimo: toNumber(requirement.material.stock_minimo),
      };
    })
    .filter((line) => line.quantity > 0);

  if (lines.length === 0) {
    throw new Error(
      "No queda nada pendiente por entregar en esta orden. Usa la entrega adicional si produccion necesita mas material.",
    );
  }

  const inactiveMaterials = lines.filter((line) => !line.materialIsActive);

  if (inactiveMaterials.length > 0) {
    throw new Error(
      `No se puede entregar materiales inactivos: ${inactiveMaterials
        .map((line) => line.materialName)
        .join(", ")}.`,
    );
  }

  const insufficient = lines.filter((line) => line.stockActual < line.quantity);

  if (insufficient.length > 0) {
    const detail = insufficient
      .map(
        (line) =>
          `${line.materialName} requiere ${line.quantity.toFixed(2)} y tiene ${line.stockActual.toFixed(2)}`,
      )
      .join("; ");

    throw new Error(`Stock insuficiente para entregar la orden: ${detail}.`);
  }

  await prisma.$transaction(async (tx) => {
    await deliverMaterials(tx, {
      idOrdenTrabajo,
      idUsuario: session.user.id,
      lines,
      motivo: `Salida por entrega de materiales a la orden ${idOrdenTrabajo}`,
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: idOrdenTrabajo,
      accion: "entregar_materiales",
      detalle: `Materiales entregados a la orden ${idOrdenTrabajo}: ${lines.length} material(es).`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${idOrdenTrabajo}`);

  redirect(
    `/dashboard/production/work-orders/${idOrdenTrabajo}?toast=work-order-materials-delivered`,
  );
}

/**
 * Entrega extra de un material puntual, por encima de lo planificado.
 *
 * Existe porque en el taller se rompen piezas y hay que rehacerlas. La alternativa seria
 * sacar el material por el modulo de inventario sin vinculo a la orden, y ahi la
 * conciliacion de esa orden quedaria falseada para siempre.
 *
 * El motivo es obligatorio: una salida por encima del plan sin explicacion es exactamente
 * el registro que nadie sabe interpretar tres meses despues.
 */
export async function deliverAdditionalMaterialAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = additionalDeliverySchema.safeParse({
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    id_requerimiento: formData.get("id_requerimiento"),
    cantidad: formData.get("cantidad"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  const requirement = await prisma.requerimiento_orden_material.findUnique({
    where: { id_requerimiento: data.id_requerimiento },
    include: {
      material: true,
      orden_trabajo: {
        select: {
          id_orden_trabajo: true,
          estado: true,
          fecha_cierre_materiales: true,
        },
      },
    },
  });

  if (!requirement) {
    throw new Error("El material solicitado no pertenece a esta orden.");
  }

  if (requirement.orden_trabajo.id_orden_trabajo !== data.id_orden_trabajo) {
    throw new Error("El material solicitado no pertenece a esta orden.");
  }

  if (
    requirement.orden_trabajo.estado === "anulada" ||
    requirement.orden_trabajo.estado === "finalizada"
  ) {
    throw new Error(
      "No se puede entregar material a una orden anulada o finalizada.",
    );
  }

  if (requirement.orden_trabajo.fecha_cierre_materiales) {
    throw new Error("Los materiales de esta orden ya fueron cerrados.");
  }

  if (!requirement.material.estado) {
    throw new Error(
      `No se puede entregar ${requirement.material.nombre_material}: el material esta inactivo.`,
    );
  }

  const stockActual = toNumber(requirement.material.stock_actual);

  if (stockActual < data.cantidad) {
    throw new Error(
      `Stock insuficiente para ${requirement.material.nombre_material}: se piden ${data.cantidad.toFixed(2)} y hay ${stockActual.toFixed(2)}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await deliverMaterials(tx, {
      idOrdenTrabajo: data.id_orden_trabajo,
      idUsuario: session.user.id,
      lines: [
        {
          idRequerimiento: requirement.id_requerimiento,
          idMaterial: requirement.id_material,
          materialName: requirement.material.nombre_material,
          quantity: data.cantidad,
          stockActual,
          stockMinimo: toNumber(requirement.material.stock_minimo),
        },
      ],
      motivo: `Entrega adicional a la orden ${data.id_orden_trabajo}: ${data.motivo}`,
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "entrega_adicional",
      detalle: `Entrega adicional de ${data.cantidad.toFixed(2)} ${requirement.unidad_medida} de ${requirement.material.nombre_material}. Motivo: ${data.motivo}`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  redirect(
    `/dashboard/production/work-orders/${data.id_orden_trabajo}?toast=work-order-additional-delivery`,
  );
}

/**
 * Devuelve al almacen material entregado y no usado.
 *
 * No se puede devolver mas de lo entregado. Como el consumo todavia no se declaro cuando
 * se devuelve, la unica cota posible en este momento es lo entregado menos lo ya devuelto.
 */
export async function returnWorkOrderMaterialAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = materialReturnSchema.safeParse({
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    id_requerimiento: formData.get("id_requerimiento"),
    cantidad: formData.get("cantidad"),
    motivo: formData.get("motivo") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  const requirement = await prisma.requerimiento_orden_material.findUnique({
    where: { id_requerimiento: data.id_requerimiento },
    include: {
      material: true,
      orden_trabajo: {
        select: {
          id_orden_trabajo: true,
          estado: true,
          fecha_cierre_materiales: true,
        },
      },
    },
  });

  if (!requirement || requirement.orden_trabajo.id_orden_trabajo !== data.id_orden_trabajo) {
    throw new Error("El material indicado no pertenece a esta orden.");
  }

  if (requirement.orden_trabajo.estado === "anulada") {
    throw new Error("No se puede devolver material de una orden anulada.");
  }

  if (requirement.orden_trabajo.fecha_cierre_materiales) {
    throw new Error(
      "Los materiales de esta orden ya fueron cerrados: no se puede mover mas material.",
    );
  }

  const entregado = toNumber(requirement.cantidad_entregada);
  const devuelto = toNumber(requirement.cantidad_devuelta);
  const devolvible = Number((entregado - devuelto).toFixed(2));

  if (devolvible <= 0) {
    throw new Error(
      `No queda material de ${requirement.material.nombre_material} por devolver: se entregaron ${entregado.toFixed(2)} y ya se devolvieron ${devuelto.toFixed(2)}.`,
    );
  }

  if (data.cantidad > devolvible) {
    throw new Error(
      `No se puede devolver ${data.cantidad.toFixed(2)} de ${requirement.material.nombre_material}: solo quedan ${devolvible.toFixed(2)} sin devolver.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await returnMaterial(tx, {
      idOrdenTrabajo: data.id_orden_trabajo,
      idUsuario: session.user.id,
      idRequerimiento: requirement.id_requerimiento,
      idMaterial: requirement.id_material,
      materialName: requirement.material.nombre_material,
      quantity: data.cantidad,
      stockActual: toNumber(requirement.material.stock_actual),
      stockMinimo: toNumber(requirement.material.stock_minimo),
      motivo: data.motivo
        ? `Devolucion de la orden ${data.id_orden_trabajo}: ${data.motivo}`
        : `Devolucion de material no usado de la orden ${data.id_orden_trabajo}`,
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "devolver_material",
      detalle: `Devolucion de ${data.cantidad.toFixed(2)} ${requirement.unidad_medida} de ${requirement.material.nombre_material}.${data.motivo ? ` Motivo: ${data.motivo}` : ""}`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  redirect(
    `/dashboard/production/work-orders/${data.id_orden_trabajo}?toast=work-order-material-returned`,
  );
}

/**
 * Cierra la conciliacion de materiales de la orden.
 *
 * Se declara lo consumido de cada material y las unidades producidas; la merma sale por
 * diferencia. A partir del cierre no se puede mover mas material contra la orden.
 *
 * Es un paso separado de finalizar la orden a proposito: un problema de conteo de material
 * no debe impedir cerrar una orden que ya se fabrico.
 */
export async function closeWorkOrderMaterialsAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idOrdenTrabajo = String(formData.get("id_orden_trabajo") ?? "").trim();
  const requirementIds = formData.getAll("id_requerimiento").map(String);
  const consumedValues = formData.getAll("cantidad_consumida").map(String);

  const parsed = closeMaterialsSchema.safeParse({
    id_orden_trabajo: idOrdenTrabajo,
    cantidad_producida: formData.get("cantidad_producida"),
    lineas: requirementIds.map((id, index) => ({
      id_requerimiento: id,
      cantidad_consumida: consumedValues[index] ?? "0",
    })),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  const workOrder = await prisma.orden_trabajo.findUnique({
    where: { id_orden_trabajo: data.id_orden_trabajo },
    include: {
      requerimiento_orden_material: {
        include: { material: { select: { nombre_material: true } } },
        orderBy: { id_requerimiento: "asc" },
      },
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (workOrder.estado === "anulada") {
    throw new Error("No se puede cerrar materiales de una orden anulada.");
  }

  if (workOrder.fecha_cierre_materiales) {
    throw new Error("Los materiales de esta orden ya fueron cerrados.");
  }

  if (workOrder.requerimiento_orden_material.length === 0) {
    throw new Error("Esta orden no tiene requerimiento congelado que conciliar.");
  }

  const requirementById = new Map(
    workOrder.requerimiento_orden_material.map((requirement) => [
      requirement.id_requerimiento,
      requirement,
    ]),
  );

  if (data.lineas.length !== requirementById.size) {
    throw new Error(
      "El cierre debe declarar el consumo de todos los materiales de la orden.",
    );
  }

  const closures = data.lineas.map((linea) => {
    const requirement = requirementById.get(linea.id_requerimiento);

    if (!requirement) {
      throw new Error("Se recibio un material que no pertenece a esta orden.");
    }

    const validation = validateClosure(
      {
        delivered: requirement.cantidad_entregada,
        consumed: linea.cantidad_consumida,
        returned: requirement.cantidad_devuelta,
      },
      requirement.material.nombre_material,
    );

    if (!validation.ok) {
      throw new Error(validation.error);
    }

    return {
      idRequerimiento: requirement.id_requerimiento,
      consumida: linea.cantidad_consumida,
      merma: validation.waste,
      materialName: requirement.material.nombre_material,
    };
  });

  const mermaTotal = closures.reduce((total, closure) => total + closure.merma, 0);

  await prisma.$transaction(async (tx) => {
    for (const closure of closures) {
      await tx.requerimiento_orden_material.update({
        where: { id_requerimiento: closure.idRequerimiento },
        data: { cantidad_consumida: closure.consumida },
      });
    }

    await tx.orden_trabajo.update({
      where: { id_orden_trabajo: data.id_orden_trabajo },
      data: {
        cantidad_producida: data.cantidad_producida,
        fecha_cierre_materiales: new Date(),
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "cerrar_materiales",
      detalle: `Materiales cerrados. Producido: ${data.cantidad_producida.toFixed(2)}. Merma total derivada: ${mermaTotal.toFixed(2)}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  redirect(
    `/dashboard/production/work-orders/${data.id_orden_trabajo}?toast=work-order-materials-closed`,
  );
}

/**
 * Reabre el cierre de materiales de una orden.
 *
 * Solo ADMIN: el maestro de taller concilia y cierra, el administrador corrige. La merma
 * declarada vuelve a ser editable, asi que el permiso se separa a proposito de quien
 * ejecuta la operacion diaria.
 *
 * Reabrir no toca el stock. El cierre solo escribio declaraciones; las entregas y
 * devoluciones que si movieron almacen quedan intactas. Por eso esta operacion no necesita
 * revertir ningun movimiento: unicamente limpia lo declarado para poder declararlo de
 * nuevo.
 */
export async function reopenWorkOrderMaterialsAction(formData: FormData) {
  const session = await requireRole(["ADMIN"]);

  const parsed = reopenMaterialsSchema.safeParse({
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  const workOrder = await prisma.orden_trabajo.findUnique({
    where: { id_orden_trabajo: data.id_orden_trabajo },
    select: {
      id_orden_trabajo: true,
      estado: true,
      cantidad_producida: true,
      fecha_cierre_materiales: true,
    },
  });

  if (!workOrder) {
    throw new Error("La orden de trabajo no existe.");
  }

  if (!workOrder.fecha_cierre_materiales) {
    throw new Error("Los materiales de esta orden no estan cerrados.");
  }

  if (workOrder.estado === "anulada") {
    throw new Error("No se puede reabrir el cierre de una orden anulada.");
  }

  const producidaAnterior = workOrder.cantidad_producida
    ? Number(workOrder.cantidad_producida.toString()).toFixed(2)
    : "sin declarar";

  await prisma.$transaction(async (tx) => {
    await tx.requerimiento_orden_material.updateMany({
      where: { id_orden_trabajo: data.id_orden_trabajo },
      data: { cantidad_consumida: 0 },
    });

    await tx.orden_trabajo.update({
      where: { id_orden_trabajo: data.id_orden_trabajo },
      data: {
        fecha_cierre_materiales: null,
        cantidad_producida: null,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "reabrir_materiales",
      detalle: `Cierre de materiales reabierto. Produccion declarada antes de reabrir: ${producidaAnterior}. Motivo: ${data.motivo}`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production/work-orders");
  revalidatePath(`/dashboard/production/work-orders/${data.id_orden_trabajo}`);

  redirect(
    `/dashboard/production/work-orders/${data.id_orden_trabajo}?toast=work-order-materials-reopened`,
  );
}

export async function annulWorkOrderAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
