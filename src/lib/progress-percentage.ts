import { toCents } from "@/lib/decimal-cents";

/**
 * El porcentaje de avance de una etapa de una orden de trabajo (C2 de la 11.6c, D79).
 *
 * La regla no cambia: pendiente 0, terminada 100, y en proceso o pausada mas de 0 y menos de 100
 * (0 o menos sube a 1, 100 o mas baja a 99). Lo que cambia es sobre que numero se aplica:
 * `porcentaje_avance` es numeric(5, 2) y redondea por su cuenta, asi que se redondea primero en
 * centesimos como la columna (decimal-cents.ts) y la regla decide sobre ese numero. Antes 99.995
 * «en proceso» pasaba la regla y se guardaba como 100.00, y 0.004 se guardaba como 0.00.
 *
 * La usan el caso de uso que guarda (progress-update.ts) y la pagina de avances para el valor
 * inicial del campo: lo que la pagina propone es lo que la accion guardaria. Funcion pura, sin
 * Prisma ni `server-only`.
 */
export function normalizeProgressPercentage(estadoEtapa: string, porcentajeAvance: number) {
  if (estadoEtapa === "pendiente") {
    return 0;
  }

  if (estadoEtapa === "terminada") {
    return 100;
  }

  // Un numero que no se puede leer cuenta como cero: el esquema ya rechaza lo que no es numero.
  const rounded = Number(toCents(porcentajeAvance) ?? 0n) / 100;

  if (rounded <= 0) {
    return 1;
  }

  if (rounded >= 100) {
    return 99;
  }

  return rounded;
}
