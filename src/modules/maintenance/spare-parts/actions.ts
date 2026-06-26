"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import {
  sparePartSchema,
  sparePartStatusSchema,
} from "@/schemas/maintenance/spare-part.schema";

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
  if (role !== APP_ROLES.ADMIN) {
    redirect("/dashboard/access-denied");
  }
}

export async function createSparePartAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = sparePartSchema.safeParse({
    id_proveedor: formData.get("id_proveedor") ?? "",
    nombre_repuesto: formData.get("nombre_repuesto"),
    descripcion: formData.get("descripcion") ?? "",
    costo_unitario: formData.get("costo_unitario"),
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  if (data.id_proveedor) {
    const provider = await prisma.proveedor.findUnique({
      where: {
        id_proveedor: data.id_proveedor,
      },
      select: {
        id_proveedor: true,
      },
    });

    if (!provider) {
      throw new Error("El proveedor seleccionado no existe.");
    }
  }

  const duplicatedSparePart = await prisma.repuesto.findFirst({
    where: {
      nombre_repuesto: {
        equals: data.nombre_repuesto,
        mode: "insensitive",
      },
    },
  });

  if (duplicatedSparePart) {
    throw new Error("Ya existe un repuesto registrado con ese nombre.");
  }

  const lastSparePart = await prisma.repuesto.findFirst({
    orderBy: {
      id_repuesto: "desc",
    },
    select: {
      id_repuesto: true,
    },
  });

  const idRepuesto = buildSequentialId(lastSparePart?.id_repuesto, "REP");

  await prisma.repuesto.create({
    data: {
      id_repuesto: idRepuesto,
      id_proveedor: data.id_proveedor || null,
      nombre_repuesto: data.nombre_repuesto,
      descripcion: data.descripcion || null,
      costo_unitario: data.costo_unitario,
      estado: data.estado,
    },
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/spare-parts");

  redirect("/dashboard/maintenance/spare-parts");
}

export async function updateSparePartStatusAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = sparePartStatusSchema.safeParse({
    id_repuesto: formData.get("id_repuesto"),
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const sparePart = await prisma.repuesto.findUnique({
    where: {
      id_repuesto: data.id_repuesto,
    },
    select: {
      id_repuesto: true,
    },
  });

  if (!sparePart) {
    throw new Error("El repuesto seleccionado no existe.");
  }

  await prisma.repuesto.update({
    where: {
      id_repuesto: data.id_repuesto,
    },
    data: {
      estado: data.estado,
    },
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/spare-parts");

  redirect("/dashboard/maintenance/spare-parts");
}