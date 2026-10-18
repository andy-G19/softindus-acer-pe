"use server";

import { revalidatePath } from "next/cache";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { getAuthorizedSession } from "@/lib/authz";
import { prisma } from "@/lib/db";

// Resultado de atender una alerta desde su fila (ConfirmActionButton): el id
// enviado y, con exito, la alerta atendida.
export type StockAlertAttendState = FormActionState<{ id: string }, { id_alerta: string }>;

function attendError(idAlert: string, error: string): StockAlertAttendState {
  return { status: "error", error, values: { id: idAlert }, operationId: newOperationId() };
}

function attendDone(idAlert: string): StockAlertAttendState {
  return { status: "success", data: { id_alerta: idAlert }, values: { id: idAlert }, operationId: newOperationId() };
}

// Atender una alerta (entrega 10.3): devuelve el resultado en lugar de
// redirigir o lanzar, y un error (sin permiso, no existe o ya estaba atendida)
// queda en la confirmacion.
export async function attendStockAlertAction(
  _prevState: StockAlertAttendState,
  formData: FormData,
): Promise<StockAlertAttendState> {
  const idAlert = String(formData.get("id_alerta") ?? "");
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return attendError(idAlert, "No tienes permisos para atender alertas de stock.");
  }

  if (!idAlert) {
    return attendError(idAlert, "La alerta es obligatoria.");
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

    return attendError(
      idAlert,
      alert ? "La alerta ya estaba atendida." : "La alerta seleccionada no existe.",
    );
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/alerts");

  return attendDone(idAlert);
}
