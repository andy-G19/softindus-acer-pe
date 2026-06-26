"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { operatorSchema } from "@/schemas/staff/operator.schema";

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

export async function createOperatorAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = operatorSchema.safeParse({
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    cargo: formData.get("cargo") ?? "",
    especialidad: formData.get("especialidad") ?? "",
    telefono: formData.get("telefono") ?? "",
    direccion: formData.get("direccion") ?? "",
    modalidad_pago: formData.get("modalidad_pago"),
    tarifa: formData.get("tarifa") ?? "",
    fecha_ingreso: formData.get("fecha_ingreso") ?? "",
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

  const duplicatedOperator = await prisma.operario.findFirst({
    where: {
      nombres: {
        equals: data.nombres,
        mode: "insensitive",
      },
      apellidos: {
        equals: data.apellidos,
        mode: "insensitive",
      },
      ...(data.telefono
        ? {
            telefono: data.telefono,
          }
        : {}),
    },
  });

  if (duplicatedOperator) {
    throw new Error("Ya existe un operario registrado con esos datos.");
  }

  const lastOperator = await prisma.operario.findFirst({
    orderBy: {
      id_operario: "desc",
    },
    select: {
      id_operario: true,
    },
  });

  const idOperario = buildSequentialId(lastOperator?.id_operario, "OPE");

  await prisma.operario.create({
    data: {
      id_operario: idOperario,
      nombres: data.nombres,
      apellidos: data.apellidos,
      cargo: data.cargo || null,
      especialidad: data.especialidad || null,
      telefono: data.telefono || null,
      direccion: data.direccion || null,
      modalidad_pago: data.modalidad_pago,
      tarifa: data.tarifa,
      fecha_ingreso: data.fecha_ingreso,
      estado: data.estado,
      observaciones: data.observaciones || null,
    },
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/operators");

  redirect("/dashboard/staff/operators");
}

export async function toggleOperatorStatusAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const idOperario = String(formData.get("id_operario") ?? "");

  if (!idOperario) {
    throw new Error("No se recibió el operario.");
  }

  const operator = await prisma.operario.findUnique({
    where: {
      id_operario: idOperario,
    },
    select: {
      id_operario: true,
      estado: true,
    },
  });

  if (!operator) {
    throw new Error("El operario seleccionado no existe.");
  }

  const nextStatus = operator.estado === "activo" ? "inactivo" : "activo";

  await prisma.operario.update({
    where: {
      id_operario: idOperario,
    },
    data: {
      estado: nextStatus,
    },
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/operators");

  redirect("/dashboard/staff/operators");
}