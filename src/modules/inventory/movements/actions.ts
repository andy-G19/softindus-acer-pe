"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";

export type InventoryOutputFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const outputSchema = z.object({
  id_material: z.string().trim().min(1, "Seleccione un material."),
  id_orden_trabajo: z.string().trim().optional().or(z.literal("")),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor que cero."),
  motivo: z
    .string()
    .trim()
    .min(3, "El motivo es obligatorio.")
    .max(300, "El motivo no debe superar 300 caracteres."),
});

async function requireOutputPermission() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!["ADMIN", "WORKSHOP_MASTER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  return session;
}

export async function createInventoryOutputAction(
  _prevState: InventoryOutputFormState,
  formData: FormData,
): Promise<InventoryOutputFormState> {
  const session = await requireOutputPermission();
  const parsed = outputSchema.safeParse({
    id_material: formData.get("id_material"),
    id_orden_trabajo: formData.get("id_orden_trabajo") ?? "",
    cantidad: formData.get("cantidad"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la salida.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const material = await prisma.material.findUnique({
    where: {
      id_material: data.id_material,
    },
    select: {
      nombre_material: true,
      stock_actual: true,
      stock_reservado: true,
      estado: true,
    },
  });

  if (!material || !material.estado) {
    return {
      error: "El material seleccionado no existe o esta inactivo.",
      fieldErrors: {
        id_material: ["El material seleccionado no existe o esta inactivo."],
      },
    };
  }

  if (data.id_orden_trabajo) {
    const workOrder = await prisma.orden_trabajo.findUnique({
      where: {
        id_orden_trabajo: data.id_orden_trabajo,
      },
      select: {
        id_orden_trabajo: true,
      },
    });

    if (!workOrder) {
      return {
        error: "La orden de trabajo seleccionada no existe.",
        fieldErrors: {
          id_orden_trabajo: ["La orden de trabajo seleccionada no existe."],
        },
      };
    }
  }

  const stockActual = Number(material.stock_actual.toString());
  const stockReservado = Number(material.stock_reservado.toString());
  const stockDisponible = stockActual - stockReservado;

  if (data.cantidad > stockDisponible) {
    return {
      error: "No hay stock suficiente para registrar la salida.",
      fieldErrors: {
        cantidad: ["No hay stock suficiente para registrar la salida."],
      },
    };
  }

  const lastMovement = await prisma.movimiento_inventario.findFirst({
    orderBy: {
      id_movimiento: "desc",
    },
    select: {
      id_movimiento: true,
    },
  });

  const idMovimiento = buildNextId("MVI", lastMovement?.id_movimiento);
  const stockResultante = stockActual - data.cantidad;

  await prisma.$transaction(async (tx) => {
    await tx.material.update({
      where: {
        id_material: data.id_material,
      },
      data: {
        stock_actual: stockResultante,
      },
    });

    await tx.movimiento_inventario.create({
      data: {
        id_movimiento: idMovimiento,
        id_material: data.id_material,
        id_orden_trabajo: data.id_orden_trabajo || null,
        tipo_movimiento: "salida",
        cantidad: data.cantidad,
        stock_anterior: stockActual,
        stock_resultante: stockResultante,
        motivo: data.motivo,
        id_usuario_responsable: session.user.id,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "movimiento_inventario",
      id_registro_afectado: idMovimiento,
      accion: "crear",
      detalle: data.id_orden_trabajo
        ? `Salida de inventario registrada para orden: ${data.id_orden_trabajo}`
        : `Salida de inventario registrada: ${material.nombre_material}`,
      tx,
    });
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/materials");
  revalidatePath("/dashboard/inventory/outputs");

  redirect("/dashboard/inventory/outputs");
}
