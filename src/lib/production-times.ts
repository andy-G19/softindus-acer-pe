/**
 * Cálculo de duración de una etapa de ruta a partir de los tiempos por unidad del
 * operario y de la máquina.
 *
 * Función pura: sin Prisma y sin `server-only`, para que la consuman por igual las
 * pantallas de rutas, el análisis de cuellos de botella y —más adelante— el costeo.
 *
 * Los minutos de operario y de máquina se guardan y se calculan SIEMPRE por separado,
 * porque cuestan distinto: el operario se paga por su tiempo y la máquina se amortiza por
 * el suyo. El modo solo determina cuánto dura la etapa, nunca cuánto cuesta.
 */

export const STAGE_TIME_MODES = {
  SIMULTANEO: "simultaneo",
  SECUENCIAL: "secuencial",
} as const;

export type StageTimeMode =
  (typeof STAGE_TIME_MODES)[keyof typeof STAGE_TIME_MODES];

export const STAGE_TIME_MODE_LABELS: Record<StageTimeMode, string> = {
  simultaneo: "Simultáneo",
  secuencial: "Secuencial",
};

export const STAGE_TIME_MODE_DESCRIPTIONS: Record<StageTimeMode, string> = {
  simultaneo:
    "El operario atiende la máquina durante toda la etapa. La etapa dura lo que tarde el más lento de los dos.",
  secuencial:
    "El operario prepara y la máquina trabaja sola. Los tiempos se suman.",
};

export function isStageTimeMode(value: unknown): value is StageTimeMode {
  return (
    typeof value === "string" &&
    Object.values(STAGE_TIME_MODES).includes(value as StageTimeMode)
  );
}

/**
 * Los Decimal de Prisma no son números nativos: llegan como objeto con `toString()`.
 * Por eso se acepta también esa forma en lugar de exigir una conversión en cada llamada.
 */
type NumericInput = number | string | { toString(): string } | null | undefined;

function toNonNegativeNumber(value: NumericInput) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value.toString());

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

type StageTimeParams = {
  operatorMinutes: NumericInput;
  machineMinutes: NumericInput;
  mode: unknown;
};

/**
 * Minutos que tarda la etapa en producir UNA unidad.
 *
 * Sin tiempo de máquina la etapa dura lo que trabaja el operario, sin importar el modo.
 * Un modo no reconocido cae a `simultaneo`: nunca se suman los tiempos por accidente,
 * que es exactamente el error que este cálculo existe para evitar.
 */
export function getStageDurationPerUnit(params: StageTimeParams) {
  const operator = toNonNegativeNumber(params.operatorMinutes);
  const machine = toNonNegativeNumber(params.machineMinutes);

  if (machine <= 0) {
    return operator;
  }

  if (params.mode === STAGE_TIME_MODES.SECUENCIAL) {
    return operator + machine;
  }

  return Math.max(operator, machine);
}

/**
 * Carga de trabajo de la etapa para una cantidad dada.
 *
 * Devuelve los tres números por separado porque responden preguntas distintas:
 * `operatorMinutes` alimenta el costo de mano de obra, `machineMinutes` la ocupación de
 * la máquina, y `durationMinutes` el tiempo de calendario de la etapa.
 */
export function getStageWorkload(
  params: StageTimeParams & { quantity: NumericInput },
) {
  const quantity = toNonNegativeNumber(params.quantity);

  return {
    operatorMinutes: toNonNegativeNumber(params.operatorMinutes) * quantity,
    machineMinutes: toNonNegativeNumber(params.machineMinutes) * quantity,
    durationMinutes: getStageDurationPerUnit(params) * quantity,
  };
}

/** Duración total de una etapa para la cantidad de una orden. */
export function getStageDurationForQuantity(
  params: StageTimeParams & { quantity: NumericInput },
) {
  return getStageWorkload(params).durationMinutes;
}
