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

  // C3 de la 11.6a (D64, hallazgo 7 de la 10.3a): cada escritura es un compare-and-set sobre la
  // alerta que sigue activa. Antes se leia la alerta activa y se actualizaba por su id: si
  // alguien la atendia entre las dos sentencias, se reescribia una alerta ya atendida y no se
  // abria otra. Postgres vuelve a evaluar el where despues de esperar a quien tenga la fila, asi
  // que una alerta atendida un instante antes ya no coincide. Dos movimientos del mismo material
  // no se cruzan aqui: los pone en fila la escritura del stock que hacen antes de llamar.
  const activeAlert = { id_material: idMaterial, estado_alerta: "activa" };

  if (stockResultante > stockMinimo) {
    await tx.alerta_stock.updateMany({
      where: activeAlert,
      data: {
        estado_alerta: "atendida",
        fecha_atencion: new Date(),
        id_usuario_atencion: params.idUsuario,
        stock_detectado: stockResultante,
        mensaje: `El material ${materialName} recupero stock por encima del minimo.`,
      },
    });

    return;
  }

  const origen = params.idOrdenTrabajo
    ? `tras mover la orden ${params.idOrdenTrabajo}`
    : "tras una salida de inventario";
  const mensaje = `El material ${materialName} quedo en stock critico ${origen}.`;

  const { count } = await tx.alerta_stock.updateMany({
    where: activeAlert,
    data: {
      stock_detectado: stockResultante,
      stock_minimo: stockMinimo,
      mensaje,
    },
  });

  if (count > 0) {
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
