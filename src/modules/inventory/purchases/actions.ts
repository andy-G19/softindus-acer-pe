"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { purchaseSchema } from "@/schemas/inventory/purchase.schema";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));
  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function buildSequentialIds(
  lastId: string | null | undefined,
  prefix: string,
  quantity: number,
) {
  const startNumber = lastId ? Number(lastId.replace(prefix, "")) : 0;

  return Array.from({ length: quantity }, (_, index) => {
    const nextNumber = startNumber + index + 1;

    return `${prefix}${String(nextNumber).padStart(8, "0")}`;
  });
}

function toNullable(value: string | undefined) {
  return value && value.trim() !== "" ? value.trim() : null;
}

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/access-denied");
  }
}

export async function createPurchaseAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const materialIds = formData.getAll("id_material").map(String);
  const quantities = formData.getAll("cantidad").map(String);
  const units = formData.getAll("unidad_medida").map(String);
  const unitCosts = formData.getAll("costo_unitario").map(String);
  const itemObservations = formData.getAll("item_observaciones").map(String);

  const items = materialIds.map((idMaterial, index) => ({
    id_material: idMaterial,
    cantidad: quantities[index],
    unidad_medida: units[index],
    costo_unitario: unitCosts[index],
    observaciones: itemObservations[index],
  }));

  const parsed = purchaseSchema.safeParse({
    id_proveedor: formData.get("id_proveedor"),
    fecha_compra: formData.get("fecha_compra"),
    tipo_comprobante: formData.get("tipo_comprobante"),
    numero_comprobante: formData.get("numero_comprobante"),
    igv: formData.get("igv"),
    observaciones: formData.get("observaciones"),
    items,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const repeatedMaterial = data.items.find((item, index) => {
    return data.items.findIndex((other) => other.id_material === item.id_material) !== index;
  });

  if (repeatedMaterial) {
    throw new Error(
      "No repitas el mismo material dentro de la compra. Ajusta la cantidad en una sola fila.",
    );
  }

  const supplier = await prisma.proveedor.findFirst({
    where: {
      id_proveedor: data.id_proveedor,
      estado: true,
    },
  });

  if (!supplier) {
    throw new Error("El proveedor seleccionado no existe o está inactivo.");
  }

  const materials = await prisma.material.findMany({
    where: {
      id_material: {
        in: data.items.map((item) => item.id_material),
      },
      estado: true,
    },
  });

  if (materials.length !== data.items.length) {
    throw new Error("Uno o más materiales no existen o están inactivos.");
  }

  const subtotal = data.items.reduce((acc, item) => {
    return acc + item.cantidad * item.costo_unitario;
  }, 0);

  const igv = data.igv ?? 0;
  const montoTotal = subtotal + igv;

  const [
    lastPurchase,
    lastPurchaseDetail,
    lastMovement,
    lastPriceHistory,
  ] = await Promise.all([
    prisma.compra.findFirst({
      orderBy: {
        id_compra: "desc",
      },
      select: {
        id_compra: true,
      },
    }),
    prisma.detalle_compra.findFirst({
      orderBy: {
        id_detalle_compra: "desc",
      },
      select: {
        id_detalle_compra: true,
      },
    }),
    prisma.movimiento_inventario.findFirst({
      orderBy: {
        id_movimiento: "desc",
      },
      select: {
        id_movimiento: true,
      },
    }),
    prisma.historial_precio_proveedor.findFirst({
      orderBy: {
        id_historial_precio: "desc",
      },
      select: {
        id_historial_precio: true,
      },
    }),
  ]);

  const idCompra = buildSequentialId(lastPurchase?.id_compra, "COM");
  const detailIds = buildSequentialIds(
    lastPurchaseDetail?.id_detalle_compra,
    "DCO",
    data.items.length,
  );
  const movementIds = buildSequentialIds(
    lastMovement?.id_movimiento,
    "MVI",
    data.items.length,
  );
  const historyIds = buildSequentialIds(
    lastPriceHistory?.id_historial_precio,
    "HPP",
    data.items.length,
  );

  const materialById = new Map(
    materials.map((material) => [material.id_material, material]),
  );

  await prisma.$transaction(async (tx) => {
    await tx.compra.create({
      data: {
        id_compra: idCompra,
        id_proveedor: data.id_proveedor,
        id_usuario_registro: session.user.id,
        fecha_compra: new Date(data.fecha_compra),
        tipo_comprobante: data.tipo_comprobante ?? null,
        numero_comprobante: data.numero_comprobante ?? null,
        subtotal,
        igv,
        monto_total: montoTotal,
        estado_pago: "pendiente",
        estado_compra: "confirmada",
        observaciones: toNullable(data.observaciones),
      },
    });

    for (const [index, item] of data.items.entries()) {
      const material = materialById.get(item.id_material);

      if (!material) {
        throw new Error("Material no encontrado durante la transacción.");
      }

      const stockAnterior = Number(material.stock_actual.toString());
      const stockResultante = stockAnterior + item.cantidad;
      const itemSubtotal = item.cantidad * item.costo_unitario;

      await tx.detalle_compra.create({
        data: {
          id_detalle_compra: detailIds[index],
          id_compra: idCompra,
          id_material: item.id_material,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida,
          costo_unitario: item.costo_unitario,
          subtotal: itemSubtotal,
          observaciones: toNullable(item.observaciones),
        },
      });

      await tx.material.update({
        where: {
          id_material: item.id_material,
        },
        data: {
          stock_actual: stockResultante,
          costo_unitario_actual: item.costo_unitario,
        },
      });

      const stockMinimo = Number(material.stock_minimo.toString());

      if (stockResultante > stockMinimo){
        await tx.alerta_stock.updateMany({
          where: {
            id_material: item.id_material,
            estado_alerta: "activa",
          },
          data: {
            estado_alerta: "atendida",
            fecha_atencion: new Date(),
            id_usuario_atencion: session.user.id,
          },
        });
      }

      await tx.movimiento_inventario.create({
        data: {
          id_movimiento: movementIds[index],
          id_material: item.id_material,
          id_compra: idCompra,
          tipo_movimiento: "entrada",
          cantidad: item.cantidad,
          stock_anterior: stockAnterior,
          stock_resultante: stockResultante,
          motivo: "Entrada automática generada por compra confirmada",
          id_usuario_responsable: session.user.id,
        },
      });

      await tx.historial_precio_proveedor.create({
        data: {
          id_historial_precio: historyIds[index],
          id_proveedor: data.id_proveedor,
          id_material: item.id_material,
          id_compra: idCompra,
          precio_unitario: item.costo_unitario,
          fecha_registro: new Date(data.fecha_compra),
          origen_registro: "compra",
          observaciones: "Precio registrado automáticamente desde compra.",
        },
      });
    }
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/materials");
  revalidatePath("/dashboard/inventory/purchases");

  redirect("/dashboard/inventory/purchases");
}