import "server-only";

import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { validateClosure } from "@/lib/material-reconciliation";
import type {
  CloseMaterialsInput,
  ReopenMaterialsInput,
} from "@/schemas/production/work-order-materials.schema";

/**
 * Cierre y reapertura de la conciliacion de materiales de una orden de trabajo.
 *
 * Casos de uso, no server actions (ver work-order-status.ts): reciben los datos ya
 * validados por el esquema y el usuario ya verificado, aplican las reglas y abren la
 * transaccion. Solo escriben declaraciones (consumido, producido, fecha de cierre): no
 * mueven stock.
 */
export type CloseWorkOrderMaterialsParams = {
  data: CloseMaterialsInput;
  idUsuario: string;
};

/**
 * Cierra la conciliacion de materiales de la orden.
 *
 * Se declara lo consumido de cada material y las unidades producidas; la merma sale por
 * diferencia. A partir del cierre no se puede mover mas material contra la orden.
 *
 * Es un paso separado de finalizar la orden a proposito: un problema de conteo de material
 * no debe impedir cerrar una orden que ya se fabrico.
 */
export async function closeWorkOrderMaterials({
  data,
  idUsuario,
}: CloseWorkOrderMaterialsParams) {
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
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "cerrar_materiales",
      detalle: `Materiales cerrados. Producido: ${data.cantidad_producida.toFixed(2)}. Merma total derivada: ${mermaTotal.toFixed(2)}.`,
      tx,
    });
  });
}

export type ReopenWorkOrderMaterialsParams = {
  data: ReopenMaterialsInput;
  idUsuario: string;
};

/**
 * Reabre el cierre de materiales de una orden.
 *
 * Solo ADMIN: el maestro de taller concilia y cierra, el administrador corrige. La merma
 * declarada vuelve a ser editable, asi que el permiso se separa a proposito de quien
 * ejecuta la operacion diaria. La accion exige el rol; este caso de uso recibe el usuario
 * ya verificado.
 *
 * Reabrir no toca el stock. El cierre solo escribio declaraciones; las entregas y
 * devoluciones que si movieron almacen quedan intactas. Por eso esta operacion no necesita
 * revertir ningun movimiento: unicamente limpia lo declarado para poder declararlo de
 * nuevo.
 */
export async function reopenWorkOrderMaterials({
  data,
  idUsuario,
}: ReopenWorkOrderMaterialsParams) {
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
      userId: idUsuario,
      entidad_afectada: "orden_trabajo",
      id_registro_afectado: data.id_orden_trabajo,
      accion: "reabrir_materiales",
      detalle: `Cierre de materiales reabierto. Produccion declarada antes de reabrir: ${producidaAnterior}. Motivo: ${data.motivo}`,
      tx,
    });
  });
}
