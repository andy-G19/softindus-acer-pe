import { z } from "zod";

const optionalTextSchema = z
  .string()
  .trim()
  .max(700, "Las observaciones no deben superar 700 caracteres.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const updateWorkOrderProgressSchema = z.object({
  id_avance: z
    .string()
    .trim()
    .min(1, "El avance de producción es obligatorio."),

  estado_etapa: z.enum(["pendiente", "en_proceso", "pausada", "terminada"]),

  porcentaje_avance: z.coerce
    .number()
    .min(0, "El porcentaje no puede ser menor a 0.")
    .max(100, "El porcentaje no puede ser mayor a 100."),

  observaciones: optionalTextSchema,
});

export const reassignWorkOrderProgressSchema = z.object({
  id_avance: z
    .string()
    .trim()
    .min(1, "El avance de produccion es obligatorio."),

  id_operario_nuevo: z
    .string()
    .trim()
    .min(1, "El nuevo operario es obligatorio."),

  motivo: z
    .string()
    .trim()
    .min(1, "El motivo de reasignacion es obligatorio.")
    .max(255, "El motivo no debe superar 255 caracteres."),
});
