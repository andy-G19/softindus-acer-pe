"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { productSchema } from "@/schemas/commercial/product.schema";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text ? text : null;
}

export async function createProductAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      ok: false,
      message: "No tienes sesión activa.",
    };
  }

  if (session.user.role !== "ADMIN") {
    return {
      ok: false,
      message: "Solo el administrador puede registrar productos.",
    };
  }

  const rawData = {
    nombre_producto: formData.get("nombre_producto")?.toString(),
    categoria: formData.get("categoria")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
    unidad_medida: formData.get("unidad_medida")?.toString(),
    precio_referencial: formData.get("precio_referencial")?.toString() || undefined,
  };

  const parsed = productSchema.safeParse(rawData);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const lastProduct = await prisma.producto.findFirst({
    orderBy: {
      id_producto: "desc",
    },
    select: {
      id_producto: true,
    },
  });

  const id_producto = buildNextId("PRO", lastProduct?.id_producto);

  await prisma.producto.create({
    data: {
      id_producto,
      nombre_producto: parsed.data.nombre_producto,
      categoria: parsed.data.categoria,
      descripcion: emptyToNull(formData.get("descripcion")),
      unidad_medida: parsed.data.unidad_medida,
      precio_referencial: parsed.data.precio_referencial ?? null,
      estado: true,
    },
  });

  revalidatePath("/dashboard/commercial/products");

  return {
    ok: true,
    message: "Producto registrado correctamente.",
  };
}