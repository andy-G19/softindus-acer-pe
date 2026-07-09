import "server-only";

import { Prisma } from "@/generated/prisma/client";

type CorrelativeRow = {
  codigo_entidad: string;
  prefijo: string;
  ultimo_numero: number;
};

type CorrelativeParams = {
  codigoEntidad: string;
  prefijo: string;
};

function formatCorrelativeId(prefijo: string, numero: number) {
  return `${prefijo}${String(numero).padStart(8, "0")}`;
}

async function lockCorrelative(
  tx: Prisma.TransactionClient,
  codigoEntidad: string,
  prefijo: string,
) {
  const rows = await tx.$queryRaw<CorrelativeRow[]>(Prisma.sql`
    SELECT codigo_entidad, prefijo, ultimo_numero
    FROM aceros.correlativo_sistema
    WHERE codigo_entidad = ${codigoEntidad}
    FOR UPDATE
  `);

  const correlative = rows[0];

  if (!correlative) {
    throw new Error(
      `No existe un correlativo configurado para "${codigoEntidad}".`,
    );
  }

  if (correlative.prefijo !== prefijo) {
    throw new Error(
      `El prefijo solicitado ("${prefijo}") no coincide con el prefijo configurado ("${correlative.prefijo}") para "${codigoEntidad}".`,
    );
  }

  return correlative;
}

export async function getNextCorrelativeId(
  tx: Prisma.TransactionClient,
  { codigoEntidad, prefijo }: CorrelativeParams,
): Promise<string> {
  const [id] = await getNextCorrelativeIds(tx, {
    codigoEntidad,
    prefijo,
    cantidad: 1,
  });

  return id;
}

export async function getNextCorrelativeIds(
  tx: Prisma.TransactionClient,
  { codigoEntidad, prefijo, cantidad }: CorrelativeParams & { cantidad: number },
): Promise<string[]> {
  if (cantidad < 1) {
    return [];
  }

  const correlative = await lockCorrelative(tx, codigoEntidad, prefijo);
  const nextUltimoNumero = correlative.ultimo_numero + cantidad;

  await tx.$executeRaw(Prisma.sql`
    UPDATE aceros.correlativo_sistema
    SET ultimo_numero = ${nextUltimoNumero}
    WHERE codigo_entidad = ${codigoEntidad}
  `);

  return Array.from({ length: cantidad }, (_, index) =>
    formatCorrelativeId(prefijo, correlative.ultimo_numero + index + 1),
  );
}
