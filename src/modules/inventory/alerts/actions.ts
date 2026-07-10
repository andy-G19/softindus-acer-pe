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

  const alert = await prisma.alerta_stock.findUnique({
    where: {
      id_alerta: idAlert,
    },
  });

  if (!alert) {
    throw new Error("La alerta seleccionada no existe.");
  }

  await prisma.alerta_stock.update({
    where: {
      id_alerta: idAlert,
    },
    data: {
      estado_alerta: "atendida",
      fecha_atencion: new Date(),
      id_usuario_atencion: session.user.id,
    },
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/alerts");

  redirect("/dashboard/inventory/alerts?toast=stock-alert-attended");
}