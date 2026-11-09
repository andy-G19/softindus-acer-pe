import "server-only";

import type { Prisma } from "@/generated/prisma/client";

// Operaciones idempotentes (entrega 11.1, tabla operacion_idempotente).
//
// El formulario genera una clave (UUID) antes de enviar. La accion, dentro de
// su prisma.$transaction y como primera instruccion (antes de los bloqueos de
// fila y de los correlativos), llama a claimOperation:
//   - "nueva": sigue con la operacion y, antes de terminar la transaccion,
//     guarda el registro creado con completeOperation.
//   - "repetida": el mismo usuario ya hizo esta operacion con esta clave;
//     responde con idRegistro sin volver a escribir.
// Si la transaccion falla, el reclamo se deshace con ella y la clave queda
// libre para reintentar.
//
// Dos envios simultaneos con la misma clave: el segundo INSERT espera a que
// termine la transaccion del primero y despues la ve como repetida (si
// confirmo) o la reclama (si se deshizo). Reclamar primero hace que choquen
// en el primer paso, sin haber tomado otros bloqueos que puedan cruzarse.

export type IdempotencyClient = Pick<Prisma.TransactionClient, "operacion_idempotente">;

export type ClaimOperationResult =
  | { estado: "nueva" }
  | { estado: "repetida"; idRegistro: string | null };

// La clave ya existe con otro usuario o en otra operacion: no se entrega el
// resultado guardado.
export class IdempotencyConflictError extends Error {
  constructor() {
    super("La clave de la operacion ya se uso en otra operacion.");
    this.name = "IdempotencyConflictError";
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres rechazaria una clave invalida abortando la transaccion; se rechaza
// antes, con un mensaje propio.
function assertValidKey(clave: string) {
  if (!UUID_PATTERN.test(clave)) {
    throw new Error("La clave de la operacion no es valida.");
  }
}

export async function claimOperation(
  tx: IdempotencyClient,
  { clave, tipo, userId }: { clave: string; tipo: string; userId: string },
): Promise<ClaimOperationResult> {
  assertValidKey(clave);

  // skipDuplicates es INSERT ... ON CONFLICT DO NOTHING: una clave repetida
  // no devuelve fila y no aborta la transaccion, como lo haria un error de
  // clave duplicada.
  const claimed = await tx.operacion_idempotente.createManyAndReturn({
    data: [{ clave, tipo_operacion: tipo, id_usuario: userId }],
    skipDuplicates: true,
    select: { clave: true },
  });

  if (claimed.length > 0) {
    return { estado: "nueva" };
  }

  const stored = await tx.operacion_idempotente.findUniqueOrThrow({
    where: { clave },
    select: { tipo_operacion: true, id_usuario: true, id_registro_resultado: true },
  });

  if (stored.id_usuario !== userId || stored.tipo_operacion !== tipo) {
    throw new IdempotencyConflictError();
  }

  return { estado: "repetida", idRegistro: stored.id_registro_resultado };
}

export async function completeOperation(
  tx: IdempotencyClient,
  { clave, idRegistro }: { clave: string; idRegistro: string },
) {
  assertValidKey(clave);

  const { count } = await tx.operacion_idempotente.updateMany({
    where: { clave },
    data: { id_registro_resultado: idRegistro },
  });

  if (count === 0) {
    throw new Error("La clave de la operacion no fue reclamada.");
  }
}
