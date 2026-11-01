"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { ActionErrorState } from "@/lib/errors";
import { lockMachineRow, lockRouteRow } from "@/lib/row-locks";
import { syncStageMachineAssignment } from "@/modules/production/stages/stage-machine";
import { routeStageSchema } from "@/schemas/production/route-stage.schema";

export type RouteStageFormState = ActionErrorState;

/**
 * Una maquina dada de baja o inactiva no puede asignarse a una etapa nueva. Una en
 * reparacion si: la reparacion es temporal y la ruta describe como se fabrica, no el
 * estado operativo de hoy.
 */
const ESTADOS_MAQUINA_NO_ASIGNABLE = ["dada_de_baja", "inactiva"];

function parseStageFormData(formData: FormData) {
  return routeStageSchema.safeParse({
    id_ruta: formData.get("id_ruta"),
    nombre_etapa: formData.get("nombre_etapa"),
    orden_secuencia: formData.get("orden_secuencia"),
    descripcion: formData.get("descripcion") ?? "",
    tiempo_operario_minutos_unidad: formData.get(
      "tiempo_operario_minutos_unidad",
    ),
    id_maquina: formData.get("id_maquina") ?? "",
    tiempo_maquina_minutos_unidad: formData.get(
      "tiempo_maquina_minutos_unidad",
    ),
    // El enum tiene default: null lo rompe, undefined lo activa.
    modo_tiempo: formData.get("modo_tiempo") ?? undefined,
    requiere_maquina: formData.get("requiere_maquina") === "on",
  });
}

/**
 * Valida la maquina dentro de la transaccion, con su fila bloqueada: despues de la ruta,
 * el orden de los candados de una etapa. El estado solo se exige cuando la maquina
 * cambia: si ya estaba asignada y despues se dio de baja, no tiene sentido bloquear la
 * edicion de otros campos de la etapa.
 */
async function validateAssignableMachine(
  tx: Prisma.TransactionClient,
  idMaquina: string,
  idMaquinaActual: string | null,
): Promise<string | null> {
  await lockMachineRow(tx, idMaquina);

  const maquina = await tx.maquina.findUnique({
    where: {
      id_maquina: idMaquina,
    },
    select: {
      id_maquina: true,
      nombre: true,
      estado: true,
    },
  });

  if (!maquina) {
    return "La máquina seleccionada no existe.";
  }

  const esMaquinaNueva = maquina.id_maquina !== idMaquinaActual;

  if (esMaquinaNueva && ESTADOS_MAQUINA_NO_ASIGNABLE.includes(maquina.estado)) {
    return `No se puede asignar la máquina "${maquina.nombre}": está ${maquina.estado.replace(/_/g, " ")}.`;
  }

  return null;
}

function machineFieldError(message: string): RouteStageFormState {
  return { error: message, fieldErrors: { id_maquina: [message] } };
}

export async function createRouteStageAction(
  _prevState: RouteStageFormState,
  formData: FormData,
): Promise<RouteStageFormState> {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = parseStageFormData(formData);

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la etapa.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
  const problem = await prisma.$transaction(async (tx): Promise<RouteStageFormState | null> => {
    await lockRouteRow(tx, data.id_ruta);

    const route = await tx.ruta_fabricacion.findFirst({
      where: {
        id_ruta: data.id_ruta,
        estado: true,
      },
      select: {
        id_ruta: true,
        nombre_ruta: true,
      },
    });

    if (!route) {
      return { error: "La ruta seleccionada no existe o está inactiva." };
    }

    const duplicatedName = await tx.etapa_ruta.findFirst({
      where: {
        id_ruta: data.id_ruta,
        nombre_etapa: data.nombre_etapa,
      },
    });

    if (duplicatedName) {
      const message = "Ya existe una etapa con ese nombre dentro de esta ruta.";

      return { error: message, fieldErrors: { nombre_etapa: [message] } };
    }

    const duplicatedOrder = await tx.etapa_ruta.findFirst({
      where: {
        id_ruta: data.id_ruta,
        orden_secuencia: data.orden_secuencia,
      },
    });

    if (duplicatedOrder) {
      const message = "Ya existe una etapa con ese número de orden en esta ruta.";

      return { error: message, fieldErrors: { orden_secuencia: [message] } };
    }

    if (data.id_maquina) {
      const machineError = await validateAssignableMachine(tx, data.id_maquina, null);

      if (machineError) {
        return machineFieldError(machineError);
      }
    }

    const idEtapaRuta = await getNextCorrelativeId(tx, {
      codigoEntidad: "etapa_ruta",
      prefijo: "ETA",
    });

    await tx.etapa_ruta.create({
      data: {
        id_etapa_ruta: idEtapaRuta,
        id_ruta: data.id_ruta,
        nombre_etapa: data.nombre_etapa,
        orden_secuencia: data.orden_secuencia,
        descripcion: data.descripcion,
        tiempo_operario_minutos_unidad:
          data.tiempo_operario_minutos_unidad ?? null,
        modo_tiempo: data.modo_tiempo,
        requiere_maquina: data.requiere_maquina,
        estado: true,
      },
    });

    await syncStageMachineAssignment(tx, {
      idEtapaRuta,
      idMaquina: data.id_maquina,
      tiempoMaquina: data.tiempo_maquina_minutos_unidad ?? null,
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "etapa_ruta",
      id_registro_afectado: idEtapaRuta,
      accion: "crear",
      detalle: `Etapa creada: ${data.nombre_etapa}`,
      tx,
    });

    return null;
  });

  if (problem) {
    return problem;
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${data.id_ruta}/stages`);

  redirect(`/dashboard/production/routes/${data.id_ruta}/stages?toast=route-stage-created`);
}

export async function updateRouteStageAction(
  _prevState: RouteStageFormState,
  formData: FormData,
): Promise<RouteStageFormState> {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idEtapaRuta = String(formData.get("id_etapa_ruta") ?? "");

  if (!idEtapaRuta) {
    return { error: "No se recibió la etapa de ruta." };
  }

  const parsed = parseStageFormData(formData);

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la etapa.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  // Se bloquea la ruta del formulario: la etapa solo sigue si es de esa ruta.
  const problem = await prisma.$transaction(async (tx): Promise<RouteStageFormState | null> => {
    await lockRouteRow(tx, data.id_ruta);

    const stage = await tx.etapa_ruta.findUnique({
      where: {
        id_etapa_ruta: idEtapaRuta,
      },
      include: {
        etapa_ruta_maquina: {
          select: {
            id_maquina: true,
          },
        },
      },
    });

    if (!stage) {
      return { error: "La etapa seleccionada no existe." };
    }

    if (stage.id_ruta !== data.id_ruta) {
      return { error: "La etapa no pertenece a la ruta indicada." };
    }

    const duplicatedName = await tx.etapa_ruta.findFirst({
      where: {
        id_ruta: data.id_ruta,
        nombre_etapa: data.nombre_etapa,
        id_etapa_ruta: {
          not: idEtapaRuta,
        },
      },
    });

    if (duplicatedName) {
      const message = "Ya existe una etapa con ese nombre dentro de esta ruta.";

      return { error: message, fieldErrors: { nombre_etapa: [message] } };
    }

    const duplicatedOrder = await tx.etapa_ruta.findFirst({
      where: {
        id_ruta: data.id_ruta,
        orden_secuencia: data.orden_secuencia,
        id_etapa_ruta: {
          not: idEtapaRuta,
        },
      },
    });

    if (duplicatedOrder) {
      const message = "Ya existe una etapa con ese número de orden en esta ruta.";

      return { error: message, fieldErrors: { orden_secuencia: [message] } };
    }

    if (data.id_maquina) {
      const idMaquinaActual = stage.etapa_ruta_maquina[0]?.id_maquina ?? null;

      const machineError = await validateAssignableMachine(
        tx,
        data.id_maquina,
        idMaquinaActual,
      );

      if (machineError) {
        return machineFieldError(machineError);
      }
    }

    await tx.etapa_ruta.update({
      where: {
        id_etapa_ruta: idEtapaRuta,
      },
      data: {
        nombre_etapa: data.nombre_etapa,
        orden_secuencia: data.orden_secuencia,
        descripcion: data.descripcion,
        tiempo_operario_minutos_unidad:
          data.tiempo_operario_minutos_unidad ?? null,
        modo_tiempo: data.modo_tiempo,
        requiere_maquina: data.requiere_maquina,
      },
    });

    await syncStageMachineAssignment(tx, {
      idEtapaRuta,
      idMaquina: data.id_maquina,
      tiempoMaquina: data.tiempo_maquina_minutos_unidad ?? null,
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "etapa_ruta",
      id_registro_afectado: idEtapaRuta,
      accion: "actualizar",
      detalle: `Etapa actualizada: ${data.nombre_etapa}`,
      tx,
    });

    return null;
  });

  if (problem) {
    return problem;
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${data.id_ruta}/stages`);

  redirect(`/dashboard/production/routes/${data.id_ruta}/stages?toast=route-stage-updated`);
}

export async function toggleRouteStageStatusAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idEtapaRuta = String(formData.get("id_etapa_ruta") ?? "");

  if (!idEtapaRuta) {
    throw new Error("No se recibió la etapa de ruta.");
  }

  const stage = await prisma.etapa_ruta.findUnique({
    where: {
      id_etapa_ruta: idEtapaRuta,
    },
    select: {
      id_etapa_ruta: true,
      id_ruta: true,
      estado: true,
    },
  });

  if (!stage) {
    throw new Error("La etapa seleccionada no existe.");
  }

  const nextStatus = !stage.estado;

  await prisma.$transaction(async (tx) => {
    await tx.etapa_ruta.update({
      where: {
        id_etapa_ruta: idEtapaRuta,
      },
      data: {
        estado: nextStatus,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "etapa_ruta",
      id_registro_afectado: idEtapaRuta,
      accion: nextStatus ? "activar" : "inactivar",
      detalle: `Etapa ${nextStatus ? "activada" : "inactivada"}: ${stage.id_etapa_ruta}`,
      tx,
    });
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${stage.id_ruta}/stages`);

  redirect(
    `/dashboard/production/routes/${stage.id_ruta}/stages?toast=${nextStatus ? "route-stage-activated" : "route-stage-deactivated"}`,
  );
}
