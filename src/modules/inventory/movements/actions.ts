"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";

type MaterialLockRow = {
  id_material: string;
  nombre_material: string;
  stock_actual: Prisma.Decimal;
  stock_reservado: Prisma.Decimal;
  estado: boolean;
};

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
  return requireRole(["ADMIN", "WORKSHOP_MASTER"]);
}

class InventoryOutputValidationError extends Error {
  field: "id_material" | "cantidad";

  constructor(field: "id_material" | "cantidad", message: string) {
    super(message);
    this.field = field;
  }
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

  const cantidad = new Prisma.Decimal(data.cantidad);

  try {
    await prisma.$transaction(async (tx) => {
      const idMovimiento = await getNextCorrelativeId(tx, {
        codigoEntidad: "movimiento_inventario",
        prefijo: "MVI",
      });

      const rows = await tx.$queryRaw<MaterialLockRow[]>(Prisma.sql`
        SELECT id_material, nombre_material, stock_actual, stock_reservado, estado
        FROM aceros.material
        WHERE id_material = ${data.id_material}
        FOR UPDATE
      `);

      const material = rows[0];

      if (!material || !material.estado) {
        throw new InventoryOutputValidationError(
          "id_material",
          "El material seleccionado no existe o esta inactivo.",
        );
      }

      const stockDisponible = material.stock_actual.minus(material.stock_reservado);

      if (cantidad.greaterThan(stockDisponible)) {
        throw new InventoryOutputValidationError(
          "cantidad",
          "No hay stock suficiente para registrar la salida.",
        );
      }

      const stockResultante = material.stock_actual.minus(cantidad);

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
          stock_anterior: material.stock_actual,
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
  } catch (error) {
    if (error instanceof InventoryOutputValidationError) {
      return {
        error: error.message,
        fieldErrors: {
          [error.field]: [error.message],
        },
      };
    }

    throw error;
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/materials");
  revalidatePath("/dashboard/inventory/outputs");

  redirect("/dashboard/inventory/outputs?toast=inventory-movement-created");
}
