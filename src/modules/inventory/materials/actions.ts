"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { materialSchema } from "@/schemas/inventory/material.schema";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));
  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
}

export async function createMaterialAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;
  const role = session.user.role;

  requireAdmin(role);

  const parsed = materialSchema.safeParse({
    nombre_material: formData.get("nombre_material"),
    categoria: formData.get("categoria"),
    unidad_medida: formData.get("unidad_medida"),
    stock_actual: formData.get("stock_actual"),
    stock_reservado: formData.get("stock_reservado"),
    stock_minimo: formData.get("stock_minimo"),
    costo_unitario_actual: formData.get("costo_unitario_actual"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const existingMaterial = await prisma.material.findUnique({
    where: {
      nombre_material: data.nombre_material,
    },
  });

  if (existingMaterial) {
    throw new Error("Ya existe un material con ese nombre.");
  }

  const lastMaterial = await prisma.material.findFirst({
    orderBy: {
      id_material: "desc",
    },
    select: {
      id_material: true,
    },
  });

  const lastMovement = await prisma.movimiento_inventario.findFirst({
    orderBy: {
      id_movimiento: "desc",
    },
    select: {
      id_movimiento: true,
    },
  });

  const lastAlert = await prisma.alerta_stock.findFirst({
    orderBy: {
      id_alerta: "desc",
    },
    select: {
      id_alerta: true,
    },
  });

  const idMaterial = buildSequentialId(lastMaterial?.id_material, "MAT");
  const idMovimiento = buildSequentialId(lastMovement?.id_movimiento, "MVI");
  const idAlerta = buildSequentialId(lastAlert?.id_alerta, "ALE");

  const shouldCreateInitialMovement = data.stock_actual > 0;
  const shouldCreateStockAlert =
    data.stock_minimo > 0 && data.stock_actual <= data.stock_minimo;

  await prisma.$transaction(async (tx) => {
    await tx.material.create({
      data: {
        id_material: idMaterial,
        nombre_material: data.nombre_material,
        categoria: data.categoria,
        unidad_medida: data.unidad_medida,
        stock_actual: data.stock_actual,
        stock_reservado: data.stock_reservado,
        stock_minimo: data.stock_minimo,
        costo_unitario_actual: data.costo_unitario_actual,
        estado: true,
      },
    });

    if (shouldCreateInitialMovement) {
      await tx.movimiento_inventario.create({
        data: {
          id_movimiento: idMovimiento,
          id_material: idMaterial,
          tipo_movimiento: "entrada",
          cantidad: data.stock_actual,
          stock_anterior: 0,
          stock_resultante: data.stock_actual,
          motivo: "Stock inicial registrado al crear el material",
          id_usuario_responsable: userId,
        },
      });
    }

    if (shouldCreateStockAlert) {
      await tx.alerta_stock.create({
        data: {
          id_alerta: idAlerta,
          id_material: idMaterial,
          stock_detectado: data.stock_actual,
          stock_minimo: data.stock_minimo,
          estado_alerta: "activa",
          mensaje: `El material ${data.nombre_material} está en stock bajo.`,
        },
      });
    }

    await registerAuditLog({
      userId,
      entidad_afectada: "material",
      id_registro_afectado: idMaterial,
      accion: "crear",
      detalle: `Material creado: ${data.nombre_material}`,
      tx,
    });
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/materials");

  redirect("/dashboard/inventory/materials");
}
