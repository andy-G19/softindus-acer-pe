"use server";

import { revalidatePath } from "next/cache";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { reusableScrapStatusSchema } from "@/schemas/waste-scrap/reusable-scrap-status.schema";

// Reutilizar y descartar desde la fila (entrega 10.7a): devuelve el resultado para
// ConfirmActionButton en lugar de redirigir. Un rechazo no revalida: el repintado
// quitaria el boton, y su mensaje con el.
export async function updateReusableScrapStatusAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const idRetazo = formData.get("id_retazo")?.toString() ?? "";
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return rowStatusError(idRetazo, "No tienes permisos para cambiar el estado de retazos.");
  }

  const parsedData = reusableScrapStatusSchema.safeParse({
    id_retazo: formData.get("id_retazo"),
    estado: formData.get("estado"),
  });

  if (!parsedData.success) {
    return rowStatusError(idRetazo, parsedData.error.issues[0]?.message ?? "Datos no válidos.");
  }

  const data = parsedData.data;

  let problem: string | null;

  try {
    // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
    problem = await prisma.$transaction(async (tx) => {
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

        return exists ? "Solo se puede cambiar el estado de retazos disponibles." : "El retazo seleccionado no existe.";
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "retazo_reutilizable",
        id_registro_afectado: data.id_retazo,
        accion: data.estado,
        detalle: `Retazo ${data.estado}: ${data.id_retazo}.`,
        tx,
      });

      return null;
    });
  } catch {
    problem = "No se pudo cambiar el estado del retazo. Intenta nuevamente.";
  }

  if (problem) {
    return rowStatusError(idRetazo, problem);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");
  revalidatePath("/dashboard/waste-scrap/reusable-scraps");

  return rowStatusDone(idRetazo, data.estado);
}
