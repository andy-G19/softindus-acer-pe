"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { scrapSchema } from "@/schemas/waste-scrap/scrap.schema";

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

  const lastScrap = await prisma.chatarra.findFirst({
    orderBy: {
      id_chatarra: "desc",
    },
    select: {
      id_chatarra: true,
    },
  });

  const idChatarra = buildSequentialId(lastScrap?.id_chatarra, "CHA");

  await prisma.chatarra.create({
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");

  redirect("/dashboard/waste-scrap");
}