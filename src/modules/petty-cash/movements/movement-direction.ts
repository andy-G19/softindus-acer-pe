/**
 * Hacia donde movio el dinero un movimiento de caja chica (C8 de la 11.4a). Un egreso o un ajuste
 * negativo sacaron dinero de la caja; un ingreso o un ajuste positivo lo metieron. Un ajuste se
 * guarda con tipo «ajuste» y su direccion vive en el concepto («Ajuste negativo: …»), como lo
 * escribe la accion de ingresos y ajustes.
 *
 * La usan la anulacion (para devolver o descontar el monto), el listado (para el signo del monto)
 * y la confirmacion de anular (para decir hacia donde va el dinero): antes la accion y el listado
 * tenian cada uno su copia.
 *
 * Funcion pura, sin Prisma ni `server-only`.
 */
export function isNegativeCashMovement(type: string, concept: string) {
  return type === "egreso" || concept.startsWith("Ajuste negativo");
}
