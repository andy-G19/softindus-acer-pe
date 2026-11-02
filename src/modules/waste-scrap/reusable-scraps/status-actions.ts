"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { reusableScrapStatusSchema } from "@/schemas/waste-scrap/reusable-scrap-status.schema";

async function requireWasteScrapAccess() {
  return requireRole(["ADMIN", "WORKSHOP_MASTER"]);
}

export async function updateReusableScrapStatusAction(formData: FormData) {
  const session = await requireWasteScrapAccess();

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

  await prisma.$transaction(async (tx) => {
    // Fija el estado solo si sigue disponible: comparar y escribir en una sola sentencia
    // evita que dos usuarios o un doble clic cambien un retazo ya reutilizado o descartado.
    const [changed] = await tx.retazo_reutilizable.updateManyAndReturn({
      where: {
        id_retazo: data.id_retazo,
        estado: "disponible",
      },
      data: {
        estado: data.estado,
      },
      select: {
        id_retazo: true,
      },
    });

    if (!changed) {
      const exists = await tx.retazo_reutilizable.findUnique({
        where: {
          id_retazo: data.id_retazo,
        },
        select: {
          id_retazo: true,
        },
      });

      throw new Error(
        exists ? "Solo se puede cambiar el estado de retazos disponibles." : "El retazo seleccionado no existe.",
      );
    }

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "retazo_reutilizable",
      id_registro_afectado: data.id_retazo,
      accion: data.estado,
      detalle: `Retazo ${data.estado}: ${data.id_retazo}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");
  revalidatePath("/dashboard/waste-scrap/reusable-scraps");

  redirect("/dashboard/waste-scrap/reusable-scraps");
}