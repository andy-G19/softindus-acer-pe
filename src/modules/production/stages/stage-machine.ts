import type { Prisma } from "@/generated/prisma/client";
import {
  getNextCorrelativeId,
  type CorrelativeTransactionClient,
} from "@/lib/correlatives-core";

/**
 * Sincronizacion de la asignacion etapa-maquina.
 *
 * Vive fuera de actions.ts a proposito: aquel es un modulo "use server", donde toda
 * funcion async exportada se convierte en un server action invocable desde el cliente.
 * Aqui es una funcion normal, testeable con un cliente de transaccion simulado.
 *
 * Se importa correlatives-core (y no @/lib/correlatives) porque este ultimo depende del
 * paquete "server-only", que solo resuelve dentro del bundler de Next.js y romperia los
 * tests. Es la MISMA implementacion.
 */
export type StageMachineTransactionClient = Pick<
  Prisma.TransactionClient,
  "etapa_ruta_maquina"
> &
  CorrelativeTransactionClient;

export type SyncStageMachineParams = {
  idEtapaRuta: string;
  idMaquina: string | null;
  tiempoMaquina: number | null;
};

/**
 * Deja la asignacion de maquina de la etapa reflejando exactamente lo recibido.
 *
 * Hoy se admite una sola maquina por etapa, pero la tabla es N:M y el tiempo vive en el
 * par etapa-maquina. Permitir varias mas adelante es dejar de borrar las demas en el
 * bloque de asignaciones obsoletas: ni migracion ni cambio de estructura.
 */
export async function syncStageMachineAssignment(
  tx: StageMachineTransactionClient,
  { idEtapaRuta, idMaquina, tiempoMaquina }: SyncStageMachineParams,
) {
  const asignacionesActuales = await tx.etapa_ruta_maquina.findMany({
    where: {
      id_etapa_ruta: idEtapaRuta,
    },
    select: {
      id_etapa_ruta_maquina: true,
      id_maquina: true,
    },
  });

  if (!idMaquina) {
    if (asignacionesActuales.length > 0) {
      await tx.etapa_ruta_maquina.deleteMany({
        where: {
          id_etapa_ruta: idEtapaRuta,
        },
      });
    }

    return;
  }

  const asignacionVigente = asignacionesActuales.find(
    (asignacion) => asignacion.id_maquina === idMaquina,
  );

  const asignacionesObsoletas = asignacionesActuales.filter(
    (asignacion) => asignacion.id_maquina !== idMaquina,
  );

  if (asignacionesObsoletas.length > 0) {
    await tx.etapa_ruta_maquina.deleteMany({
      where: {
        id_etapa_ruta_maquina: {
          in: asignacionesObsoletas.map(
            (asignacion) => asignacion.id_etapa_ruta_maquina,
          ),
        },
      },
    });
  }

  if (asignacionVigente) {
    await tx.etapa_ruta_maquina.update({
      where: {
        id_etapa_ruta_maquina: asignacionVigente.id_etapa_ruta_maquina,
      },
      data: {
        tiempo_maquina_minutos_unidad: tiempoMaquina,
      },
    });

    return;
  }

  const idAsignacion = await getNextCorrelativeId(tx, {
    codigoEntidad: "etapa_ruta_maquina",
    prefijo: "ERM",
  });

  await tx.etapa_ruta_maquina.create({
    data: {
      id_etapa_ruta_maquina: idAsignacion,
      id_etapa_ruta: idEtapaRuta,
      id_maquina: idMaquina,
      tiempo_maquina_minutos_unidad: tiempoMaquina,
    },
  });
}
