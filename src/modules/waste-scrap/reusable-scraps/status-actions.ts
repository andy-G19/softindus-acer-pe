"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { reusableScrapStatusSchema } from "@/schemas/waste-scrap/reusable-scrap-status.schema";

async function requireWasteScrapAccess() {
  return requireRole(["ADMIN", "WORKSHOP_MASTER"]);
}

export async function updateReusableScrapStatusAction(formData: FormData) {
  await requireWasteScrapAccess();

  const parsedData = reusableScrapStatusSchema.safeParse({
    id_retazo: formData.get("id_retazo"),
    estado: formData.get("estado"),
  });

  if (!parsedData.success) {
    const message = parsedData.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsedData.data;

  const reusableScrap = await prisma.retazo_reutilizable.findUnique({
    where: {
      id_retazo: data.id_retazo,
    },
    select: {
      id_retazo: true,
      estado: true,
    },
  });

  if (!reusableScrap) {
    throw new Error("El retazo seleccionado no existe.");
  }

  if (reusableScrap.estado !== "disponible") {
    throw new Error(
      "Solo se puede cambiar el estado de retazos disponibles.",
    );
  }

  await prisma.retazo_reutilizable.update({
    where: {
      id_retazo: data.id_retazo,
    },
    data: {
      estado: data.estado,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");
  revalidatePath("/dashboard/waste-scrap/reusable-scraps");

  redirect("/dashboard/waste-scrap/reusable-scraps");
}