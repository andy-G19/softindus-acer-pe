"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  machineSchema,
  machineStatusSchema,
} from "@/schemas/maintenance/machine.schema";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));

  if (Number.isNaN(currentNumber)) {
    return `${prefix}00000001`;
  }

  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
}

export async function createMachineAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = machineSchema.safeParse({
    nombre: formData.get("nombre"),
    tipo: formData.get("tipo"),
    codigo_interno: formData.get("codigo_interno") ?? "",
    ubicacion: formData.get("ubicacion") ?? "",
    estado: formData.get("estado"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const duplicatedMachine = await prisma.maquina.findFirst({
    where: {
      OR: [
        {
          AND: [
            {
              nombre: {
                equals: data.nombre,
                mode: "insensitive",
              },
            },
            {
              tipo: {
                equals: data.tipo,
                mode: "insensitive",
              },
            },
          ],
        },
        ...(data.codigo_interno
          ? [
              {
                codigo_interno: data.codigo_interno,
              },
            ]
          : []),
      ],
    },
  });

  if (duplicatedMachine) {
    throw new Error(
      "Ya existe una máquina registrada con ese nombre, tipo o código interno.",
    );
  }

  const lastMachine = await prisma.maquina.findFirst({
    orderBy: {
      id_maquina: "desc",
    },
    select: {
      id_maquina: true,
    },
  });

  const idMaquina = buildSequentialId(lastMachine?.id_maquina, "MAQ");

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

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/machines");

  redirect("/dashboard/maintenance/machines");
}

export async function updateMachineStatusAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = machineStatusSchema.safeParse({
    id_maquina: formData.get("id_maquina"),
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const machine = await prisma.maquina.findUnique({
    where: {
      id_maquina: data.id_maquina,
    },
    select: {
      id_maquina: true,
    },
  });

  if (!machine) {
    throw new Error("La máquina seleccionada no existe.");
  }

  await prisma.maquina.update({
    where: {
      id_maquina: data.id_maquina,
    },
    data: {
      estado: data.estado,
    },
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/machines");

  redirect("/dashboard/maintenance/machines");
}