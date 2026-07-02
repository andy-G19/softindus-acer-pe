"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { APP_ROLES } from "@/lib/permissions";
import {
  machineSchema,
  machineStatusSchema,
} from "@/schemas/maintenance/machine.schema";

export type MachineFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const MACHINES_PATH = "/dashboard/maintenance/machines";

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== APP_ROLES.ADMIN) {
    redirect("/dashboard/access-denied");
  }

  return session;
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
  const session = await requireAdmin();
  const parsed = machineSchema.safeParse(getMachineFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la maquina.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const duplicated = await hasDuplicateMachine(
    data.nombre,
    data.tipo,
    data.codigo_interno || undefined,
  );

  if (duplicated) {
    return {
      error:
        "Ya existe una maquina registrada con ese nombre, tipo o codigo interno.",
      fieldErrors: {
        nombre: [
          "Ya existe una maquina registrada con ese nombre, tipo o codigo interno.",
        ],
      },
    };
  }

  const lastMachine = await prisma.maquina.findFirst({
    orderBy: {
      id_maquina: "desc",
    },
    select: {
      id_maquina: true,
    },
  });

  const idMaquina = buildNextId("MAQ", lastMachine?.id_maquina);

  try {
    await prisma.maquina.create({
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
    });
  } catch (error) {
    return {
      error: getPrismaErrorMessage(error),
    };
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath(MACHINES_PATH);

  redirect(MACHINES_PATH);
}

export async function updateMachineAction(
  _prevState: MachineFormState,
  formData: FormData,
): Promise<MachineFormState> {
  const session = await requireAdmin();
  const machineId = formData.get("id_maquina")?.toString().trim();

  if (!machineId) {
    return { error: "La maquina no existe." };
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
    return { error: "La maquina no existe." };
  }

  const parsed = machineSchema.safeParse(getMachineFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la maquina.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const duplicated = await hasDuplicateMachine(
    data.nombre,
    data.tipo,
    data.codigo_interno || undefined,
    machineId,
  );

  if (duplicated) {
    return {
      error:
        "Ya existe otra maquina registrada con ese nombre, tipo o codigo interno.",
      fieldErrors: {
        nombre: [
          "Ya existe otra maquina registrada con ese nombre, tipo o codigo interno.",
        ],
      },
    };
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
    return {
      error: getPrismaErrorMessage(error),
    };
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath(MACHINES_PATH);

  redirect(MACHINES_PATH);
}

export async function updateMachineStatusAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = machineStatusSchema.safeParse({
    id_maquina: formData.get("id_maquina"),
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    redirect(MACHINES_PATH);
  }

  const data = parsed.data;
  const machine = await prisma.maquina.findUnique({
    where: {
      id_maquina: data.id_maquina,
    },
    select: {
      nombre: true,
    },
  });

  if (!machine) {
    redirect(MACHINES_PATH);
  }

  await prisma.maquina.update({
    where: {
      id_maquina: data.id_maquina,
    },
    data: {
      estado: data.estado,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "maquina",
    id_registro_afectado: data.id_maquina,
    accion: "actualizar",
    detalle: `Estado de maquina actualizado: ${machine.nombre}`,
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath(MACHINES_PATH);

  redirect(MACHINES_PATH);
}

export async function toggleMachineStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const machineId = formData.get("id_maquina")?.toString().trim();

  if (!machineId) {
    redirect(MACHINES_PATH);
  }

  const machine = await prisma.maquina.findUnique({
    where: {
      id_maquina: machineId,
    },
    select: {
      nombre: true,
      estado: true,
    },
  });

  if (!machine) {
    redirect(MACHINES_PATH);
  }

  const nextStatus = machine.estado === "inactiva" ? "operativa" : "inactiva";

  await prisma.maquina.update({
    where: {
      id_maquina: machineId,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "maquina",
    id_registro_afectado: machineId,
    accion: nextStatus === "operativa" ? "activar" : "inactivar",
    detalle: `Maquina ${
      nextStatus === "operativa" ? "activada" : "inactivada"
    }: ${machine.nombre}`,
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath(MACHINES_PATH);

  redirect(MACHINES_PATH);
}
