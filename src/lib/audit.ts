import "server-only";

import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";

type AuditClient = Pick<typeof prisma, "bitacora_operacion">;

type RegisterAuditLogInput = {
  userId: string;
  entidad_afectada: string;
  id_registro_afectado?: string | null;
  accion: string;
  detalle?: string | null;
  ip_origen?: string | null;
  tx?: AuditClient;
};

async function createAuditLog(data: RegisterAuditLogInput) {
  const client = data.tx ?? prisma;

  const lastAuditLog = await client.bitacora_operacion.findFirst({
    orderBy: {
      id_bitacora: "desc",
    },
    select: {
      id_bitacora: true,
    },
  });

  const id_bitacora = buildNextId("BIT", lastAuditLog?.id_bitacora);

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
    await createAuditLog(data);
    return;
  }

  try {
    await createAuditLog(data);
  } catch (error) {
    console.error("No se pudo registrar la bitacora de operacion.", error);
  }
}
