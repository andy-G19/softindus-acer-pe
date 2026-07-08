"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
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
    redirect("/dashboard/access-denied");
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

  await prisma.$transaction(async (tx) => {
    await tx.ruta_fabricacion.create({
      data: {
        id_ruta: idRuta,
        id_producto: data.id_producto,
        nombre_ruta: data.nombre_ruta,
        descripcion: data.descripcion,
        estado: true,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "ruta_fabricacion",
      id_registro_afectado: idRuta,
      accion: "crear",
      detalle: `Ruta creada: ${data.nombre_ruta}`,
      tx,
    });
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");

  redirect("/dashboard/production/routes?toast=route-created");
}

export async function updateFabricationRouteAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const idRuta = String(formData.get("id_ruta") ?? "");

  if (!idRuta) {
    throw new Error("No se recibio la ruta de fabricacion.");
  }

  const parsed = fabricationRouteSchema.safeParse({
    id_producto: formData.get("id_producto"),
    nombre_ruta: formData.get("nombre_ruta"),
    descripcion: formData.get("descripcion") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  const currentRoute = await prisma.ruta_fabricacion.findUnique({
    where: {
      id_ruta: idRuta,
    },
    include: {
      _count: {
        select: {
          orden_trabajo: true,
        },
      },
    },
  });

  if (!currentRoute) {
    throw new Error("La ruta seleccionada no existe.");
  }

  if (currentRoute._count.orden_trabajo > 0 && currentRoute.id_producto !== data.id_producto) {
    throw new Error(
      "No se puede cambiar el producto de una ruta con ordenes asociadas.",
    );
  }

  const product = await prisma.producto.findFirst({
    where: {
      id_producto: data.id_producto,
      estado: true,
    },
    select: {
      id_producto: true,
    },
  });

  if (!product) {
    throw new Error("El producto seleccionado no existe o esta inactivo.");
  }

  const existingRoute = await prisma.ruta_fabricacion.findFirst({
    where: {
      id_producto: data.id_producto,
      nombre_ruta: data.nombre_ruta,
      id_ruta: {
        not: idRuta,
      },
    },
  });

  if (existingRoute) {
    throw new Error("Ya existe una ruta con ese nombre para este producto.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.ruta_fabricacion.update({
      where: {
        id_ruta: idRuta,
      },
      data: {
        id_producto: data.id_producto,
        nombre_ruta: data.nombre_ruta,
        descripcion: data.descripcion,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "ruta_fabricacion",
      id_registro_afectado: idRuta,
      accion: "actualizar",
      detalle: `Ruta actualizada: ${data.nombre_ruta}`,
      tx,
    });
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${idRuta}/stages`);

  redirect("/dashboard/production/routes?toast=route-updated");
}

export async function toggleFabricationRouteStatusAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const idRuta = String(formData.get("id_ruta") ?? "");

  if (!idRuta) {
    throw new Error("No se recibio la ruta de fabricacion.");
  }

  const route = await prisma.ruta_fabricacion.findUnique({
    where: {
      id_ruta: idRuta,
    },
    select: {
      id_ruta: true,
      nombre_ruta: true,
      estado: true,
    },
  });

  if (!route) {
    throw new Error("La ruta seleccionada no existe.");
  }

  const nextStatus = !route.estado;

  await prisma.$transaction(async (tx) => {
    await tx.ruta_fabricacion.update({
      where: {
        id_ruta: idRuta,
      },
      data: {
        estado: nextStatus,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "ruta_fabricacion",
      id_registro_afectado: idRuta,
      accion: nextStatus ? "activar" : "inactivar",
      detalle: `Ruta ${nextStatus ? "activada" : "inactivada"}: ${route.nombre_ruta}`,
      tx,
    });
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${idRuta}/stages`);

  redirect(
    `/dashboard/production/routes?toast=${nextStatus ? "route-activated" : "route-deactivated"}`,
  );
}
