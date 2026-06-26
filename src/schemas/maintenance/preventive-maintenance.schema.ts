import { z } from "zod";

const preventiveStatuses = ["pendiente", "realizado", "vencido", "anulado"];

export const preventiveMaintenanceSchema = z.object({
  id_maquina: z
    .string()
    .trim()
    .length(11, "Seleccione una máquina válida."),

  fecha_programada: z
    .string()
    .trim()
    .min(1, "La fecha programada es obligatoria.")
    .transform((value) => new Date(`${value}T00:00:00`)),

  responsable: z
    .string()
    .trim()
    .max(100, "El responsable no debe superar los 100 caracteres.")
    .optional()
    .or(z.literal("")),

  actividad: z
    .string()
    .trim()
    .min(5, "La actividad debe tener al menos 5 caracteres.")
    .max(255, "La actividad no debe superar los 255 caracteres."),

  estado: z
    .string()
    .trim()
    .refine(
      (value) => preventiveStatuses.includes(value),
      "Seleccione un estado válido.",
    ),

  observaciones: z
    .string()
    .trim()
    .max(1000, "Las observaciones no deben superar los 1000 caracteres.")
    .optional()
    .or(z.literal("")),
});

export const preventiveMaintenanceStatusSchema = z.object({
  id_mantenimiento: z
    .string()
    .trim()
    .length(11, "El identificador del mantenimiento no es válido."),

  estado: z
    .string()
    .trim()
    .refine(
      (value) => preventiveStatuses.includes(value),
      "Seleccione un estado válido.",
    ),
});