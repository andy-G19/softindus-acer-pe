import { z } from "zod";

import { STAGE_TIME_MODES } from "@/lib/production-times";

const MAX_MINUTOS_UNIDAD = 9999.99;

/**
 * Minutos por unidad: opcional, pero si se envía debe ser mayor que cero. Un cero o un
 * negativo no es "sin dato", es un dato equivocado.
 */
function minutosPorUnidad() {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      const text = value.toString().trim();

      return text === "" ? undefined : text;
    },
    z.coerce
      .number({ message: "El tiempo debe ser numérico." })
      .positive("El tiempo debe ser mayor que cero.")
      .max(
        MAX_MINUTOS_UNIDAD,
        `El tiempo no debe superar ${MAX_MINUTOS_UNIDAD} minutos por unidad.`,
      )
      .optional(),
  );
}

export const routeStageSchema = z
  .object({
    id_ruta: z.string().trim().min(1, "La ruta de fabricación es obligatoria."),

    nombre_etapa: z
      .string()
      .trim()
      .min(3, "El nombre de la etapa debe tener al menos 3 caracteres.")
      .max(100, "El nombre de la etapa no debe superar 100 caracteres."),

    orden_secuencia: z.coerce
      .number()
      .int("El orden debe ser un número entero.")
      .min(1, "El orden debe ser mayor o igual a 1.")
      .max(999, "El orden no debe superar 999."),

    descripcion: z
      .string()
      .trim()
      .max(500, "La descripción no debe superar 500 caracteres.")
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),

    /** Minutos de trabajo del operario para producir UNA unidad. */
    tiempo_operario_minutos_unidad: minutosPorUnidad(),

    /** Máquina utilizada en la etapa. Hoy una sola; el modelo admite varias. */
    id_maquina: z
      .string()
      .trim()
      .max(11, "El identificador de la máquina no debe superar 11 caracteres.")
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),

    /** Minutos de uso de la máquina para producir UNA unidad. */
    tiempo_maquina_minutos_unidad: minutosPorUnidad(),

    modo_tiempo: z
      .enum([STAGE_TIME_MODES.SIMULTANEO, STAGE_TIME_MODES.SECUENCIAL], {
        error: "Selecciona un modo de trabajo válido.",
      })
      .default(STAGE_TIME_MODES.SIMULTANEO),

    requiere_maquina: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.id_maquina && data.tiempo_maquina_minutos_unidad === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Indica cuántos minutos de máquina se necesitan para producir una unidad.",
        path: ["tiempo_maquina_minutos_unidad"],
      });
    }

    // Error explícito en lugar de descartar el dato en silencio: si llegó un tiempo de
    // máquina sin máquina, alguien se equivocó y conviene que lo sepa.
    if (!data.id_maquina && data.tiempo_maquina_minutos_unidad !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "No puedes registrar tiempo de máquina sin seleccionar una máquina.",
        path: ["tiempo_maquina_minutos_unidad"],
      });
    }
  })
  .transform((data) => ({
    ...data,
    // Invariante: si hay máquina asignada, la etapa la requiere. No puede existir una
    // etapa con máquina que declare no necesitarla.
    requiere_maquina: data.id_maquina ? true : data.requiere_maquina,
  }));

export type RouteStageInput = z.infer<typeof routeStageSchema>;
