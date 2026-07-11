import { Prisma } from "@/generated/prisma/client";
import { formatCorrelativeId } from "@/lib/correlatives-format";

// Implementacion real y unica del generador transaccional de correlativos.
// No importa "server-only" a proposito: la usan tanto src/lib/correlatives.ts
// (re-exportado para el runtime de la app via Next.js) como
// scripts/bootstrap-admin.ts (ejecutado directamente con tsx, donde
// "server-only" no es resoluble fuera del bundler de Next). Mantener una
// unica implementacion evita que ambos consumidores diverjan.

type CorrelativeRow = {
  codigo_entidad: string;
  prefijo: string;
  ultimo_numero: number;
};

export type CorrelativeParams = {
  codigoEntidad: string;
  prefijo: string;
};

// Subconjunto de Prisma.TransactionClient que en realidad se usa aqui: solo
// SQL crudo parametrizado. Permite reutilizar el mismo tipo con cualquier
// cliente transaccional compatible (incluido en tests, con un mock liviano).
export type CorrelativeTransactionClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw"
>;

async function lockCorrelative(
  tx: CorrelativeTransactionClient,
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
  tx: CorrelativeTransactionClient,
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
  tx: CorrelativeTransactionClient,
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
