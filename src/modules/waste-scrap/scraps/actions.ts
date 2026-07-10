"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { scrapSchema } from "@/schemas/waste-scrap/scrap.schema";

function requireWasteScrapAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export async function createScrapAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireWasteScrapAccess(session.user.role);

  const parsedData = scrapSchema.safeParse({
    id_material: formData.get("id_material"),
    tipo_material: formData.get("tipo_material"),
    peso_kg: formData.get("peso_kg"),
    cantidad: formData.get("cantidad"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsedData.success) {
    const message = parsedData.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsedData.data;

  if (data.id_material) {
    const material = await prisma.material.findUnique({
      where: {
        id_material: data.id_material,
      },
      select: {
        id_material: true,
        estado: true,
      },
    });

    if (!material) {
      throw new Error("El material de origen seleccionado no existe.");
    }

    if (!material.estado) {
      throw new Error("No se puede registrar chatarra de un material inactivo.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const idChatarra = await getNextCorrelativeId(tx, {
      codigoEntidad: "chatarra",
      prefijo: "CHA",
    });

    await tx.chatarra.create({
      data: {
        id_chatarra: idChatarra,
        id_material: data.id_material,
        tipo_material: data.tipo_material,
        peso_kg: data.peso_kg ?? null,
        cantidad: data.cantidad ?? null,
        estado: "acumulada",
        observaciones: data.observaciones,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "chatarra",
      id_registro_afectado: idChatarra,
      accion: "crear",
      detalle: `Chatarra registrada: ${data.tipo_material}`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");

  redirect("/dashboard/waste-scrap?toast=scrap-created");
}
