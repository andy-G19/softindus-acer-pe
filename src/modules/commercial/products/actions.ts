"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
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
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const rawData = {
    nombre_producto: formData.get("nombre_producto")?.toString(),
    categoria: formData.get("categoria")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
    unidad_medida: formData.get("unidad_medida")?.toString(),
    precio_referencial:
      formData.get("precio_referencial")?.toString() || undefined,
  };

  const parsed = productSchema.safeParse(rawData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
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
      fecha_registro: new Date(),
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "producto",
    id_registro_afectado: id_producto,
    accion: "crear",
    detalle: `Producto creado: ${parsed.data.nombre_producto}`,
  });

  revalidatePath("/dashboard/commercial/products");
  redirect("/dashboard/commercial/products");
}
