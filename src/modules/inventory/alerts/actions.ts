"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";

export async function attendStockAlertAction(formData: FormData) {
  const session = await requireRole(["ADMIN"]);

  const idAlert = String(formData.get("id_alerta") ?? "");

  if (!idAlert) {
    throw new Error("La alerta es obligatoria.");
  }

  // Atiende la alerta solo si sigue activa: comparar y escribir en una sola
  // sentencia evita que un doble clic o una lista desactualizada cambien quien
  // la atendio y cuando. count 0: no existe o ya estaba atendida.
  const { count } = await prisma.alerta_stock.updateMany({
    where: {
      id_alerta: idAlert,
      estado_alerta: "activa",
    },
    data: {
      estado_alerta: "atendida",
      fecha_atencion: new Date(),
      id_usuario_atencion: session.user.id,
    },
  });

  if (count === 0) {
    const alert = await prisma.alerta_stock.findUnique({
      where: {
        id_alerta: idAlert,
      },
      select: {
        id_alerta: true,
      },
    });

    if (!alert) {
      throw new Error("La alerta seleccionada no existe.");
    }

    redirect("/dashboard/inventory/alerts");
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/alerts");

  redirect("/dashboard/inventory/alerts?toast=stock-alert-attended");
}