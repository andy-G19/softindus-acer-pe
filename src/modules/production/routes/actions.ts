"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { lockRouteRow } from "@/lib/row-locks";
import { fabricationRouteSchema } from "@/schemas/production/route.schema";

const DUPLICATED_ROUTE = "Ya existe una ruta con ese nombre para este producto.";

// Una carrera por el nombre llega como violacion de uq_ruta_producto_nombre: al
// crear no hay fila que bloquear, y al editar el otro puede estar creando.
function toRouteSaveError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new Error(DUPLICATED_ROUTE);
  }

  return error;
}

export async function createFabricationRouteAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
    throw new Error(DUPLICATED_ROUTE);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const idRuta = await getNextCorrelativeId(tx, {
        codigoEntidad: "ruta_fabricacion",
        prefijo: "RUT",
      });

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
  } catch (error) {
    throw toRouteSaveError(error);
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");

  redirect("/dashboard/production/routes?toast=route-created");
}

export async function updateFabricationRouteAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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

  try {
    await prisma.$transaction(async (tx) => {
      await lockRouteRow(tx, idRuta);

      const currentRoute = await tx.ruta_fabricacion.findUnique({
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

      // El producto actual se conserva aunque hoy este inactivo, como en pedidos.
      if (data.id_producto !== currentRoute.id_producto) {
        const product = await tx.producto.findFirst({
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
      }

      const existingRoute = await tx.ruta_fabricacion.findFirst({
        where: {
          id_producto: data.id_producto,
          nombre_ruta: data.nombre_ruta,
          id_ruta: {
            not: idRuta,
          },
        },
      });

      if (existingRoute) {
        throw new Error(DUPLICATED_ROUTE);
      }

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
  } catch (error) {
    throw toRouteSaveError(error);
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${idRuta}/stages`);

  redirect("/dashboard/production/routes?toast=route-updated");
}

export async function toggleFabricationRouteStatusAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
