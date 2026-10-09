import "server-only";

import { prisma } from "@/lib/db";
import { toNonNegativeNumber } from "@/lib/numbers";
import { lockCostingRow } from "@/lib/row-locks";

type CostingClient = Pick<
  typeof prisma,
  "costeo" | "costo_indirecto" | "tarea_operario" | "$queryRaw"
>;

export async function calculateEstimatedLaborCost(
  client: CostingClient,
  idOrdenTrabajo: string | null | undefined,
) {
  if (!idOrdenTrabajo) {
    return 0;
  }

  const tasks = await client.tarea_operario.findMany({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
      estado: {
        not: "anulada",
      },
    },
    include: {
      operario: {
        select: {
          tarifa: true,
        },
      },
    },
  });

  return tasks.reduce((total, task) => {
    // Estimado: depende de que la tarea tenga horas y el operario tenga tarifa registrada.
    const hours = toNonNegativeNumber(task.horas_dedicadas);
    const rate = toNonNegativeNumber(task.operario.tarifa);

    return total + hours * rate;
  }, 0);
}

/**
 * Recalcula los totales del costeo desde sus componentes. Recibe el cliente de la
 * transaccion que cambio esos componentes.
 *
 * Bloquea el costeo antes de leer sus montos (H3): dos operaciones que cambian el total a
 * la vez (anular dos costos indirectos, o la mano de obra y un costo indirecto) quedan en
 * fila, y la segunda suma lo que confirmo la primera. Sin el bloqueo, la ultima en escribir
 * dejaba un total calculado con datos viejos.
 */
export async function recalculateCostingTotals(
  client: CostingClient,
  idCosteo: string,
) {
  await lockCostingRow(client, idCosteo);

  const costing = await client.costeo.findUnique({
    where: {
      id_costeo: idCosteo,
    },
    select: {
      id_costeo: true,
      costo_materiales: true,
      costo_consumibles: true,
      costo_mano_obra: true,
      cantidad_base: true,
    },
  });

  if (!costing) {
    throw new Error("El costeo seleccionado no existe.");
  }

  const indirectCosts = await client.costo_indirecto.findMany({
    where: {
      id_costeo: idCosteo,
    },
    select: {
      monto: true,
    },
  });

  const indirectCostTotal = indirectCosts.reduce((total, item) => {
    return total + toNonNegativeNumber(item.monto);
  }, 0);

  const totalCost =
    toNonNegativeNumber(costing.costo_materiales) +
    toNonNegativeNumber(costing.costo_consumibles) +
    toNonNegativeNumber(costing.costo_mano_obra) +
    indirectCostTotal;

  const baseQuantity = toNonNegativeNumber(costing.cantidad_base);
  const unitCost = baseQuantity > 0 ? totalCost / baseQuantity : null;

  return client.costeo.update({
    where: {
      id_costeo: idCosteo,
    },
    data: {
      costo_indirecto_total: indirectCostTotal,
      costo_total: totalCost,
      costo_unitario: unitCost,
    },
  });
}
