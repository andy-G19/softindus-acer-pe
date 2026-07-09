import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";

type RegisterAuditLogInput = {
  userId: string;
  entidad_afectada: string;
  id_registro_afectado?: string | null;
  accion: string;
  detalle?: string | null;
  ip_origen?: string | null;
  tx?: Prisma.TransactionClient;
};

async function createAuditLog(
  client: Prisma.TransactionClient,
  data: RegisterAuditLogInput,
) {
  const id_bitacora = await getNextCorrelativeId(client, {
    codigoEntidad: "bitacora_operacion",
    prefijo: "BIT",
  });

  await client.bitacora_operacion.create({
    data: {
      id_bitacora,
      id_usuario: data.userId,
      entidad_afectada: data.entidad_afectada,
      id_registro_afectado: data.id_registro_afectado ?? null,
      accion: data.accion,
      detalle: data.detalle ?? null,
      ip_origen: data.ip_origen ?? null,
    },
  });
}

export async function registerAuditLog(data: RegisterAuditLogInput) {
  if (data.tx) {
    await createAuditLog(data.tx, data);
    return;
  }

  try {
    await prisma.$transaction((tx) => createAuditLog(tx, data));
  } catch (error) {
    console.error("No se pudo registrar la bitacora de operacion.", error);
  }
}
