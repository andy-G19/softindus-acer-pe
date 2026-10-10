import "server-only";

import { Prisma } from "@/generated/prisma/client";

/**
 * Bloqueos de fila para las operaciones que leen un registro, deciden con lo leido y
 * escriben (grupo 1 de fixes).
 *
 * Se toman dentro de la transaccion y antes de leer lo que decide la escritura. Si otra
 * transaccion tiene la fila, esta espera a que confirme; como PostgreSQL trabaja en READ
 * COMMITTED, cada sentencia posterior ya ve lo que la otra escribio. Sin el bloqueo, dos
 * operaciones simultaneas leen lo mismo y la ultima en escribir pisa a la primera.
 *
 * FOR NO KEY UPDATE y no FOR UPDATE: insertar una fila hija (un costo indirecto, un
 * movimiento de inventario) toma FOR KEY SHARE sobre el padre para proteger la clave
 * foranea. FOR UPDATE choca con ese candado, y dos operaciones sobre el mismo padre podrian
 * bloquearse mutuamente; FOR NO KEY UPDATE no choca con el, pero si consigo mismo y con
 * cualquier UPDATE del padre, que son las operaciones que hay que poner en fila.
 *
 * Solo protege entre quienes lo toman, y solo dentro de una transaccion: fuera de ella el
 * candado dura una sentencia.
 */
type RowLockClient = Pick<Prisma.TransactionClient, "$queryRaw">;

export async function lockCostingRow(tx: RowLockClient, idCosteo: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_costeo
    FROM aceros.costeo
    WHERE id_costeo = ${idCosteo}
    FOR NO KEY UPDATE
  `);
}

export async function lockWorkOrderRow(tx: RowLockClient, idOrdenTrabajo: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_orden_trabajo
    FROM aceros.orden_trabajo
    WHERE id_orden_trabajo = ${idOrdenTrabajo}
    FOR NO KEY UPDATE
  `);
}

export async function lockIndirectCostRow(tx: RowLockClient, idCostoIndirecto: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_costo_indirecto
    FROM aceros.costo_indirecto
    WHERE id_costo_indirecto = ${idCostoIndirecto}
    FOR NO KEY UPDATE
  `);
}
