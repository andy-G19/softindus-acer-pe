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

export async function lockRouteRow(tx: RowLockClient, idRuta: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_ruta
    FROM aceros.ruta_fabricacion
    WHERE id_ruta = ${idRuta}
    FOR NO KEY UPDATE
  `);
}

export async function lockRecipeRow(tx: RowLockClient, idReceta: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_receta
    FROM aceros.receta_tecnica
    WHERE id_receta = ${idReceta}
    FOR NO KEY UPDATE
  `);
}

export async function lockCampaignRow(tx: RowLockClient, idCampania: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_campania
    FROM aceros.campania_produccion
    WHERE id_campania = ${idCampania}
    FOR NO KEY UPDATE
  `);
}

export async function lockUserRow(tx: RowLockClient, idUsuario: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_usuario
    FROM aceros.usuario
    WHERE id_usuario = ${idUsuario}
    FOR NO KEY UPDATE
  `);
}

export async function lockOperatorRow(tx: RowLockClient, idOperario: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_operario
    FROM aceros.operario
    WHERE id_operario = ${idOperario}
    FOR NO KEY UPDATE
  `);
}

export async function lockMachineRow(tx: RowLockClient, idMaquina: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_maquina
    FROM aceros.maquina
    WHERE id_maquina = ${idMaquina}
    FOR NO KEY UPDATE
  `);
}

export async function lockFailureRow(tx: RowLockClient, idFalla: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_falla
    FROM aceros.falla_maquina
    WHERE id_falla = ${idFalla}
    FOR NO KEY UPDATE
  `);
}

export async function lockPreventiveMaintenanceRow(tx: RowLockClient, idMantenimiento: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_mantenimiento
    FROM aceros.mantenimiento_preventivo
    WHERE id_mantenimiento = ${idMantenimiento}
    FOR NO KEY UPDATE
  `);
}

// Comercial (11.3a): el pedido antes que su proforma. Crear proforma bloquea el pedido; el pago
// y anular proforma bloquean la proforma.
export async function lockOrderRow(tx: RowLockClient, idPedido: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_pedido
    FROM aceros.pedido
    WHERE id_pedido = ${idPedido}
    FOR NO KEY UPDATE
  `);
}

export async function lockQuoteRow(tx: RowLockClient, idProforma: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_proforma
    FROM aceros.proforma
    WHERE id_proforma = ${idProforma}
    FOR NO KEY UPDATE
  `);
}

// Caja chica (C3 de la 11.4a, D44): el egreso, el ingreso o ajuste y anular un movimiento bloquean
// la caja antes de leer su saldo. Una operacion que toma otra fila de la 11.4 (el movimiento que
// anula; en la 11.4b, la chatarra que vende) la bloquea primero: la caja va siempre al final,
// porque es el padre que todas comparten.
export async function lockCashBoxRow(tx: RowLockClient, idCajaChica: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_caja_chica
    FROM aceros.caja_chica
    WHERE id_caja_chica = ${idCajaChica}
    FOR NO KEY UPDATE
  `);
}

export async function lockCashMovementRow(tx: RowLockClient, idMovimientoCaja: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_movimiento_caja
    FROM aceros.movimiento_caja
    WHERE id_movimiento_caja = ${idMovimientoCaja}
    FOR NO KEY UPDATE
  `);
}

// Venta de chatarra (C3 de la 11.4b, D48): la chatarra se bloquea antes de leerla, y despues su
// caja (lockCashBoxRow), que va al final como en toda la 11.4.
export async function lockScrapRow(tx: RowLockClient, idChatarra: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_chatarra
    FROM aceros.chatarra
    WHERE id_chatarra = ${idChatarra}
    FOR NO KEY UPDATE
  `);
}

export async function lockPurchaseRow(tx: RowLockClient, idCompra: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_compra
    FROM aceros.compra
    WHERE id_compra = ${idCompra}
    FOR NO KEY UPDATE
  `);
}

export async function lockRepairRow(tx: RowLockClient, idReparacion: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT id_reparacion
    FROM aceros.reparacion
    WHERE id_reparacion = ${idReparacion}
    FOR NO KEY UPDATE
  `);
}
