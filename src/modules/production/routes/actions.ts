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
import { lockRouteRow } from "@/lib/row-locks";
import { fabricationRouteSchema } from "@/schemas/production/route.schema";

/** Lo que el formulario de ruta envio, tal cual, para volver a mostrarlo. */
export type FabricationRouteFormValues = {
  id_producto: string;
  nombre_ruta: string;
  descripcion: string;
};

// Entrega 10.6a: el alta y la edicion se usan desde el panel lateral y devuelven
// el resultado; sin permiso responden con un error, no redirigen.
export type FabricationRouteFormState = FormActionState<FabricationRouteFormValues, { id_ruta: string }>;

type RouteProblem = { error: string; fieldErrors?: FieldErrors };

const DUPLICATED_ROUTE = "Ya existe una ruta con ese nombre para este producto.";
const INACTIVE_PRODUCT = "El producto seleccionado no existe o está inactivo.";
const PERMISSION_ERROR = "No tienes permisos para gestionar rutas de fabricación.";

const duplicatedRoute: RouteProblem = { error: DUPLICATED_ROUTE, fieldErrors: { nombre_ruta: [DUPLICATED_ROUTE] } };
const inactiveProduct: RouteProblem = { error: INACTIVE_PRODUCT, fieldErrors: { id_producto: [INACTIVE_PRODUCT] } };

function getRouteFormValues(formData: FormData): FabricationRouteFormValues {
  const text = (name: keyof FabricationRouteFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_producto: text("id_producto"),
    nombre_ruta: text("nombre_ruta"),
    descripcion: text("descripcion"),
  };
}

function routeError(
  values: FabricationRouteFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): FabricationRouteFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function routeSaved(values: FabricationRouteFormValues, idRuta: string): FabricationRouteFormState {
  return { status: "success", data: { id_ruta: idRuta }, values, operationId: newOperationId() };
}

// Una carrera por el nombre llega como violacion de uq_ruta_producto_nombre: al
// crear no hay fila que bloquear, y al editar el otro puede estar creando.
function routeSaveProblem(error: unknown): RouteProblem {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return duplicatedRoute;
  }

  return { error: "No se pudo guardar la ruta. Intenta nuevamente." };
}

export async function createFabricationRouteAction(
  _prevState: FabricationRouteFormState,
  formData: FormData,
): Promise<FabricationRouteFormState> {
  const values = getRouteFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return routeError(values, PERMISSION_ERROR);
  }

  const parsed = fabricationRouteSchema.safeParse({
    id_producto: formData.get("id_producto"),
    nombre_ruta: formData.get("nombre_ruta"),
    descripcion: formData.get("descripcion") ?? "",
  });

  if (!parsed.success) {
    return routeError(values, "Revisa los datos de la ruta.", parsed.error.flatten().fieldErrors);
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
    return routeError(values, inactiveProduct.error, inactiveProduct.fieldErrors);
  }

  const existingRoute = await prisma.ruta_fabricacion.findFirst({
    where: {
      id_producto: data.id_producto,
      nombre_ruta: data.nombre_ruta,
    },
  });

  if (existingRoute) {
    return routeError(values, duplicatedRoute.error, duplicatedRoute.fieldErrors);
  }

  let idRuta: string;

  try {
    idRuta = await prisma.$transaction(async (tx) => {
      const idNuevo = await getNextCorrelativeId(tx, {
        codigoEntidad: "ruta_fabricacion",
        prefijo: "RUT",
      });

      await tx.ruta_fabricacion.create({
        data: {
          id_ruta: idNuevo,
          id_producto: data.id_producto,
          nombre_ruta: data.nombre_ruta,
          descripcion: data.descripcion,
          estado: true,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "ruta_fabricacion",
        id_registro_afectado: idNuevo,
        accion: "crear",
        detalle: `Ruta creada: ${data.nombre_ruta}`,
        tx,
      });

      return idNuevo;
    });
  } catch (error) {
    const problem = routeSaveProblem(error);

    return routeError(values, problem.error, problem.fieldErrors);
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");

  return routeSaved(values, idRuta);
}

export async function updateFabricationRouteAction(
  _prevState: FabricationRouteFormState,
  formData: FormData,
): Promise<FabricationRouteFormState> {
  const values = getRouteFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return routeError(values, PERMISSION_ERROR);
  }

  const idRuta = String(formData.get("id_ruta") ?? "");

  if (!idRuta) {
    return routeError(values, "No se recibió la ruta de fabricación.");
  }

  const parsed = fabricationRouteSchema.safeParse({
    id_producto: formData.get("id_producto"),
    nombre_ruta: formData.get("nombre_ruta"),
    descripcion: formData.get("descripcion") ?? "",
  });

  if (!parsed.success) {
    return routeError(values, "Revisa los datos de la ruta.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  let problem: RouteProblem | null;

  try {
    // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
    problem = await prisma.$transaction(async (tx): Promise<RouteProblem | null> => {
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
        return { error: "La ruta seleccionada no existe." };
      }

      if (currentRoute._count.orden_trabajo > 0 && currentRoute.id_producto !== data.id_producto) {
        const message = "No se puede cambiar el producto de una ruta con órdenes asociadas.";

        return { error: message, fieldErrors: { id_producto: [message] } };
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
          return inactiveProduct;
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
        return duplicatedRoute;
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

      return null;
    });
  } catch (error) {
    problem = routeSaveProblem(error);
  }

  if (problem) {
    return routeError(values, problem.error, problem.fieldErrors);
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${idRuta}/stages`);

  return routeSaved(values, idRuta);
}

// Activar e inactivar desde la fila (entrega 10.6a): devuelven el resultado para
// ConfirmActionButton en lugar de redirigir con ?toast=, y sin permiso responden
// con un error.
export async function toggleFabricationRouteStatusAction(
  _prevState: StatusToggleState,
  formData: FormData,
): Promise<StatusToggleState> {
  const idRuta = formData.get("id_ruta")?.toString() ?? "";
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return statusToggleError(idRuta, PERMISSION_ERROR);
  }

  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!idRuta) {
    return statusToggleError(idRuta, "No se recibió la ruta de fabricación.");
  }

  if (nextStatus === null) {
    return statusToggleError(idRuta, "Estado no válido.");
  }

  let problem: string | null;

  try {
    problem = await prisma.$transaction(async (tx) => {
      // Fija el estado pedido solo si la ruta tiene el contrario: comparar y escribir
      // en una sola sentencia evita que una lista desactualizada o un doble clic
      // hagan lo contrario de lo que dice el boton. La misma sentencia devuelve el
      // nombre que pide la bitacora, sin leer antes.
      const [route] = await tx.ruta_fabricacion.updateManyAndReturn({
        where: {
          id_ruta: idRuta,
          estado: !nextStatus,
        },
        data: {
          estado: nextStatus,
        },
        select: {
          nombre_ruta: true,
        },
      });

      // Nada cambio: no existe o ya tenia ese estado; no hay nada que registrar.
      if (!route) {
        const exists = await tx.ruta_fabricacion.findUnique({
          where: {
            id_ruta: idRuta,
          },
          select: {
            id_ruta: true,
          },
        });

        return exists ? `La ruta ya estaba ${nextStatus ? "activa" : "inactiva"}.` : "La ruta seleccionada no existe.";
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "ruta_fabricacion",
        id_registro_afectado: idRuta,
        accion: nextStatus ? "activar" : "inactivar",
        detalle: `Ruta ${nextStatus ? "activada" : "inactivada"}: ${route.nombre_ruta}`,
        tx,
      });

      return null;
    });
  } catch {
    problem = "No se pudo cambiar el estado de la ruta. Intenta nuevamente.";
  }

  if (problem) {
    return statusToggleError(idRuta, problem);
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${idRuta}/stages`);

  return statusToggleDone(idRuta, nextStatus);
}
