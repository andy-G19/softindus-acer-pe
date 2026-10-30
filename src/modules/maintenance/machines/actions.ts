"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import {
  parseRequestedStatus,
  statusToggleDone,
  statusToggleError,
  type StatusToggleState,
} from "@/lib/requested-status";
import { machineSchema } from "@/schemas/maintenance/machine.schema";

/** Lo que el formulario de maquina envio, tal cual, para volver a mostrarlo. */
export type MachineFormValues = {
  nombre: string;
  tipo: string;
  codigo_interno: string;
  ubicacion: string;
  estado: string;
  observaciones: string;
};

// Entrega 10.5a: el alta y la edicion de maquinas no redirigen; devuelven el
// resultado y el formulario da el aviso y cierra el panel o vuelve al listado.
// Sin permiso responden con un error, no redirigen.
export type MachineFormState = FormActionState<MachineFormValues, { id_maquina: string }>;

const MACHINES_PATH = "/dashboard/maintenance/machines";

function getMachineFormValues(formData: FormData): MachineFormValues {
  const text = (name: keyof MachineFormValues) => formData.get(name)?.toString() ?? "";

  return {
    nombre: text("nombre"),
    tipo: text("tipo"),
    codigo_interno: text("codigo_interno"),
    ubicacion: text("ubicacion"),
    estado: text("estado"),
    observaciones: text("observaciones"),
  };
}

function machineError(values: MachineFormValues, error: string, fieldErrors?: FieldErrors): MachineFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function machineSaved(values: MachineFormValues, idMaquina: string): MachineFormState {
  return { status: "success", data: { id_maquina: idMaquina }, values, operationId: newOperationId() };
}

function getMachineFormData(formData: FormData) {
  return {
    nombre: formData.get("nombre"),
    tipo: formData.get("tipo"),
    codigo_interno: formData.get("codigo_interno") ?? "",
    ubicacion: formData.get("ubicacion") ?? "",
    estado: formData.get("estado"),
    observaciones: formData.get("observaciones") ?? "",
  };
}

async function hasDuplicateMachine(
  nombre: string,
  tipo: string,
  codigoInterno?: string,
  currentMachineId?: string,
) {
  const duplicatedMachine = await prisma.maquina.findFirst({
    where: {
      OR: [
        {
          AND: [
            {
              nombre: {
                equals: nombre,
                mode: "insensitive",
              },
            },
            {
              tipo: {
                equals: tipo,
                mode: "insensitive",
              },
            },
          ],
        },
        ...(codigoInterno
          ? [
              {
                codigo_interno: codigoInterno,
              },
            ]
          : []),
      ],
    },
    select: {
      id_maquina: true,
    },
  });

  if (!duplicatedMachine) {
    return false;
  }

  return duplicatedMachine.id_maquina !== currentMachineId;
}

function getPrismaErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Ya existe una maquina con ese codigo interno.";
  }

  return "No se pudo guardar la maquina. Intenta nuevamente.";
}

export async function createMachineAction(
  _prevState: MachineFormState,
  formData: FormData,
): Promise<MachineFormState> {
  const values = getMachineFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return machineError(values, "No tienes permisos para registrar máquinas.");
  }

  const parsed = machineSchema.safeParse(getMachineFormData(formData));

  if (!parsed.success) {
    return machineError(values, "Revisa los datos de la maquina.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const duplicated = await hasDuplicateMachine(
    data.nombre,
    data.tipo,
    data.codigo_interno || undefined,
  );

  if (duplicated) {
    return machineError(values, "Ya existe una maquina registrada con ese nombre, tipo o codigo interno.", {
      nombre: ["Ya existe una maquina registrada con ese nombre, tipo o codigo interno."],
    });
  }

  let idMaquina = "";

  try {
    await prisma.$transaction(async (tx) => {
      idMaquina = await getNextCorrelativeId(tx, {
        codigoEntidad: "maquina",
        prefijo: "MAQ",
      });

      await tx.maquina.create({
        data: {
          id_maquina: idMaquina,
          nombre: data.nombre,
          tipo: data.tipo,
          codigo_interno: data.codigo_interno || null,
          ubicacion: data.ubicacion || null,
          estado: data.estado,
          observaciones: data.observaciones || null,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "maquina",
        id_registro_afectado: idMaquina,
        accion: "crear",
        detalle: `Maquina creada: ${data.nombre}`,
        tx,
      });
    });
  } catch (error) {
    return machineError(values, getPrismaErrorMessage(error));
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath(MACHINES_PATH);

  return machineSaved(values, idMaquina);
}

export async function updateMachineAction(
  _prevState: MachineFormState,
  formData: FormData,
): Promise<MachineFormState> {
  const values = getMachineFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return machineError(values, "No tienes permisos para editar máquinas.");
  }

  const machineId = formData.get("id_maquina")?.toString().trim();

  if (!machineId) {
    return machineError(values, "La maquina no existe.");
  }

  const currentMachine = await prisma.maquina.findUnique({
    where: {
      id_maquina: machineId,
    },
    select: {
      id_maquina: true,
    },
  });

  if (!currentMachine) {
    return machineError(values, "La maquina no existe.");
  }

  const parsed = machineSchema.safeParse(getMachineFormData(formData));

  if (!parsed.success) {
    return machineError(values, "Revisa los datos de la maquina.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const duplicated = await hasDuplicateMachine(
    data.nombre,
    data.tipo,
    data.codigo_interno || undefined,
    machineId,
  );

  if (duplicated) {
    return machineError(values, "Ya existe otra maquina registrada con ese nombre, tipo o codigo interno.", {
      nombre: ["Ya existe otra maquina registrada con ese nombre, tipo o codigo interno."],
    });
  }

  try {
    await prisma.maquina.update({
      where: {
        id_maquina: machineId,
      },
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        codigo_interno: data.codigo_interno || null,
        ubicacion: data.ubicacion || null,
        estado: data.estado,
        observaciones: data.observaciones || null,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "maquina",
      id_registro_afectado: machineId,
      accion: "actualizar",
      detalle: `Maquina actualizada: ${data.nombre}`,
    });
  } catch (error) {
    return machineError(values, getPrismaErrorMessage(error));
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath(MACHINES_PATH);

  return machineSaved(values, machineId);
}

// Activar o inactivar desde la fila (ConfirmActionButton). El boton envia el
// estado pedido: "false" deja la maquina inactiva desde cualquier otro estado y
// "true" la deja operativa solo si estaba inactiva. Comparar y escribir en una
// sola sentencia evita que una lista desactualizada o un doble clic hagan lo
// contrario de lo que dice el boton.
export async function toggleMachineStatusAction(
  _prevState: StatusToggleState,
  formData: FormData,
): Promise<StatusToggleState> {
  const machineId = formData.get("id_maquina")?.toString().trim() ?? "";
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return statusToggleError(machineId, "No tienes permisos para activar o inactivar máquinas.");
  }

  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!machineId) {
    return statusToggleError(machineId, "La máquina no existe.");
  }

  if (nextStatus === null) {
    return statusToggleError(machineId, "Estado no válido.");
  }

  const { count } = await prisma.maquina.updateMany({
    where: {
      id_maquina: machineId,
      estado: nextStatus ? "inactiva" : { not: "inactiva" },
    },
    data: {
      estado: nextStatus ? "operativa" : "inactiva",
    },
  });

  const machine = await prisma.maquina.findUnique({
    where: {
      id_maquina: machineId,
    },
    select: {
      nombre: true,
    },
  });

  // count 0: no existe o ya tenia ese estado; no hay nada que registrar.
  if (count === 0) {
    return statusToggleError(
      machineId,
      machine ? `La máquina ya estaba ${nextStatus ? "activa" : "inactiva"}.` : "La máquina no existe.",
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "maquina",
    id_registro_afectado: machineId,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Maquina ${nextStatus ? "activada" : "inactivada"}: ${machine?.nombre ?? machineId}`,
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath(MACHINES_PATH);

  return statusToggleDone(machineId, nextStatus);
}
