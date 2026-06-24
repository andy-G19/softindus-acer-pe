"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { fabricationRouteSchema } from "@/schemas/production/route.schema";

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

function requireProductionManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

export async function createFabricationRouteAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = fabricationRouteSchema.safeParse({
    id_producto: formData.get("id_producto"),
    nombre_ruta: formData.get("nombre_ruta"),
    descripcion: formData.get("descripcion") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const product = await prisma.producto.findFirst({
    where: {
      id_producto: data.id_producto,
      estado: true,
    },
    select: {
      id_producto: true,
      nombre_producto: true,
    },
  });

  if (!product) {
    throw new Error("El producto seleccionado no existe o está inactivo.");
  }

  const existingRoute = await prisma.ruta_fabricacion.findFirst({
    where: {
      id_producto: data.id_producto,
      nombre_ruta: data.nombre_ruta,
    },
  });

  if (existingRoute) {
    throw new Error("Ya existe una ruta con ese nombre para este producto.");
  }

  const lastRoute = await prisma.ruta_fabricacion.findFirst({
    orderBy: {
      id_ruta: "desc",
    },
    select: {
      id_ruta: true,
    },
  });

  const idRuta = buildSequentialId(lastRoute?.id_ruta, "RUT");

  await prisma.ruta_fabricacion.create({
    data: {
      id_ruta: idRuta,
      id_producto: data.id_producto,
      nombre_ruta: data.nombre_ruta,
      descripcion: data.descripcion,
      estado: true,
    },
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");

  redirect("/dashboard/production/routes");
}