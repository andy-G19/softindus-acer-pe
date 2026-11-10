import type { Prisma } from "@/generated/prisma/client";
import {
  getNextCorrelativeIds,
  type CorrelativeTransactionClient,
} from "@/lib/correlatives-core";

/**
 * Regla de la alerta de stock critico de un material, de Inventario (C3 de la 11.2c).
 *
 * Vivia en production/work-orders/material-delivery.ts, que la usa en la entrega y la
 * devolucion a una orden. Pasa aqui porque la alerta es de Inventario y la salida de
 * inventario la va a aplicar tambien (D16). Quien la llama le pasa el stock que devolvio su
 * propia escritura (H2), no uno leido antes.
 *
 * Como material-delivery.ts, importa correlatives-core y no @/lib/correlatives, que depende
 * del paquete "server-only".
 */

/**
 * Abre o actualiza la alerta de stock critico tras mover el stock de un material.
 *
 * Se resuelve la alerta cuando el stock vuelve por encima del minimo: sin esto, una
 * devolucion dejaria la alerta activa sobre un material que ya no esta en riesgo.
 *
 * idOrdenTrabajo es null en una salida de inventario sin orden (C4 de la 11.2c): el mensaje
 * nombra la orden solo cuando la hay.
 */
export async function syncStockAlert(
  tx: Pick<Prisma.TransactionClient, "alerta_stock"> &
    CorrelativeTransactionClient,
  params: {
    idMaterial: string;
    materialName: string;
    stockResultante: number;
    stockMinimo: number;
    idOrdenTrabajo: string | null;
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

  const origen = params.idOrdenTrabajo
    ? `tras mover la orden ${params.idOrdenTrabajo}`
    : "tras una salida de inventario";
  const mensaje = `El material ${materialName} quedo en stock critico ${origen}.`;

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
