import type { Prisma } from "@/generated/prisma/client";
import {
  getNextCorrelativeIds,
  type CorrelativeTransactionClient,
} from "@/lib/correlatives-core";
import { toNumber } from "@/lib/numbers";

/**
 * Entrega de material del almacen a una orden de trabajo.
 *
 * Vive fuera de actions.ts porque aquel es un modulo "use server", donde toda funcion
 * async exportada se convierte en un server action invocable desde el cliente. Una
 * funcion que descuenta stock es lo ultimo que conviene exponer asi.
 *
 * Se importa correlatives-core y no @/lib/correlatives porque este ultimo depende del
 * paquete "server-only", que solo resuelve dentro del bundler de Next.js.
 */
export type DeliveryTransactionClient = Pick<
  Prisma.TransactionClient,
  | "material"
  | "movimiento_inventario"
  | "alerta_stock"
  | "requerimiento_orden_material"
> &
  CorrelativeTransactionClient;

/**
 * Sin stock: el que anotan el kardex y la alerta sale de la propia escritura (H2), no de
 * una lectura de quien llama.
 */
export type DeliveryLine = {
  idRequerimiento: string;
  idMaterial: string;
  materialName: string;
  /** Cantidad a sacar del almacen en esta entrega. */
  quantity: number;
};

export type DeliveryParams = {
  idOrdenTrabajo: string;
  idUsuario: string;
  lines: DeliveryLine[];
  /** Texto que queda en movimiento_inventario.motivo. */
  motivo: string;
};

/**
 * Descuenta stock, registra los movimientos, actualiza las alertas de stock critico y
 * acumula lo entregado en el requerimiento congelado.
 *
 * El descuento usa updateManyAndReturn condicionado a que el stock alcance: si dos
 * entregas corren a la vez, la segunda no encuentra la fila y aborta la transaccion
 * completa en lugar de dejar el stock en negativo.
 *
 * El kardex y la alerta usan el stock que devuelve ese mismo descuento (H2), como la
 * compra. Una lectura previa, aunque sea dentro de la transaccion y con la orden
 * bloqueada, no ve lo que otra orden, una compra o una salida confirmen antes de esta
 * escritura, y el kardex quedaria con dos movimientos que parten del mismo stock.
 */
export async function deliverMaterials(
  tx: DeliveryTransactionClient,
  { idOrdenTrabajo, idUsuario, lines, motivo }: DeliveryParams,
) {
  if (lines.length === 0) {
    throw new Error("No hay materiales que entregar.");
  }

  const movementIds = await getNextCorrelativeIds(tx, {
    codigoEntidad: "movimiento_inventario",
    prefijo: "MVI",
    cantidad: lines.length,
  });

  for (const [index, line] of lines.entries()) {
    const [material] = await tx.material.updateManyAndReturn({
      where: {
        id_material: line.idMaterial,
        stock_actual: {
          gte: line.quantity,
        },
      },
      data: {
        stock_actual: {
          decrement: line.quantity,
        },
      },
      select: {
        stock_actual: true,
        stock_minimo: true,
      },
    });

    if (!material) {
      throw new Error(
        `Stock insuficiente para ${line.materialName}. La operacion fue cancelada.`,
      );
    }

    const stockResultante = material.stock_actual;
    const stockAnterior = stockResultante.plus(line.quantity);

    await tx.movimiento_inventario.create({
      data: {
        id_movimiento: movementIds[index],
        id_material: line.idMaterial,
        id_orden_trabajo: idOrdenTrabajo,
        tipo_movimiento: "salida",
        cantidad: line.quantity,
        stock_anterior: stockAnterior,
        stock_resultante: stockResultante,
        motivo,
        id_usuario_responsable: idUsuario,
      },
    });

    await tx.requerimiento_orden_material.update({
      where: {
        id_requerimiento: line.idRequerimiento,
      },
      data: {
        cantidad_entregada: {
          increment: line.quantity,
        },
      },
    });

    await syncStockAlert(tx, {
      idMaterial: line.idMaterial,
      materialName: line.materialName,
      stockResultante: toNumber(stockResultante),
      stockMinimo: toNumber(material.stock_minimo),
      idOrdenTrabajo,
      idUsuario,
    });
  }
}

/** Sin stock, como DeliveryLine: lo devuelve la propia escritura (H2). */
export type ReturnParams = {
  idOrdenTrabajo: string;
  idUsuario: string;
  idRequerimiento: string;
  idMaterial: string;
  materialName: string;
  quantity: number;
  motivo: string;
};

/**
 * Devolucion al almacen de material entregado y no usado.
 *
 * Es la operacion inversa de la entrega: incrementa stock, registra un movimiento de tipo
 * 'devolucion' y acumula en cantidad_devuelta. No necesita la guarda de concurrencia del
 * descuento porque sumar stock nunca puede dejarlo en negativo. El kardex y la alerta usan
 * el stock que devuelve el incremento (H2).
 */
export async function returnMaterial(
  tx: DeliveryTransactionClient,
  params: ReturnParams,
) {
  const [idMovimiento] = await getNextCorrelativeIds(tx, {
    codigoEntidad: "movimiento_inventario",
    prefijo: "MVI",
    cantidad: 1,
  });

  const material = await tx.material.update({
    where: {
      id_material: params.idMaterial,
    },
    data: {
      stock_actual: {
        increment: params.quantity,
      },
    },
    select: {
      stock_actual: true,
      stock_minimo: true,
    },
  });

  const stockResultante = material.stock_actual;
  const stockAnterior = stockResultante.minus(params.quantity);

  await tx.movimiento_inventario.create({
    data: {
      id_movimiento: idMovimiento,
      id_material: params.idMaterial,
      id_orden_trabajo: params.idOrdenTrabajo,
      tipo_movimiento: "devolucion",
      cantidad: params.quantity,
      stock_anterior: stockAnterior,
      stock_resultante: stockResultante,
      motivo: params.motivo,
      id_usuario_responsable: params.idUsuario,
    },
  });

  await tx.requerimiento_orden_material.update({
    where: {
      id_requerimiento: params.idRequerimiento,
    },
    data: {
      cantidad_devuelta: {
        increment: params.quantity,
      },
    },
  });

  await syncStockAlert(tx, {
    idMaterial: params.idMaterial,
    materialName: params.materialName,
    stockResultante: toNumber(stockResultante),
    stockMinimo: toNumber(material.stock_minimo),
    idOrdenTrabajo: params.idOrdenTrabajo,
    idUsuario: params.idUsuario,
  });
}

/**
 * Abre o actualiza la alerta de stock critico tras mover el stock de un material.
 *
 * Se resuelve la alerta cuando el stock vuelve por encima del minimo: sin esto, una
 * devolucion dejaria la alerta activa sobre un material que ya no esta en riesgo.
 */
export async function syncStockAlert(
  tx: Pick<Prisma.TransactionClient, "alerta_stock"> &
    CorrelativeTransactionClient,
  params: {
    idMaterial: string;
    materialName: string;
    stockResultante: number;
    stockMinimo: number;
    idOrdenTrabajo: string;
    idUsuario: string;
  },
) {
  const { idMaterial, materialName, stockResultante, stockMinimo } = params;

  const alertaActiva = await tx.alerta_stock.findFirst({
    where: {
      id_material: idMaterial,
      estado_alerta: "activa",
    },
    select: {
      id_alerta: true,
    },
  });

  if (stockResultante > stockMinimo) {
    if (alertaActiva) {
      await tx.alerta_stock.update({
        where: {
          id_alerta: alertaActiva.id_alerta,
        },
        data: {
          estado_alerta: "atendida",
          fecha_atencion: new Date(),
          id_usuario_atencion: params.idUsuario,
          stock_detectado: stockResultante,
          mensaje: `El material ${materialName} recupero stock por encima del minimo.`,
        },
      });
    }

    return;
  }

  const mensaje = `El material ${materialName} quedo en stock critico tras mover la orden ${params.idOrdenTrabajo}.`;

  if (alertaActiva) {
    await tx.alerta_stock.update({
      where: {
        id_alerta: alertaActiva.id_alerta,
      },
      data: {
        stock_detectado: stockResultante,
        stock_minimo: stockMinimo,
        mensaje,
      },
    });

    return;
  }

  const [idAlerta] = await getNextCorrelativeIds(tx, {
    codigoEntidad: "alerta_stock",
    prefijo: "ALE",
    cantidad: 1,
  });

  await tx.alerta_stock.create({
    data: {
      id_alerta: idAlerta,
      id_material: idMaterial,
      stock_detectado: stockResultante,
      stock_minimo: stockMinimo,
      estado_alerta: "activa",
      mensaje,
    },
  });
}
