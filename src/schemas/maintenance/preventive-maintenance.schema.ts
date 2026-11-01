import { z } from "zod";

import { toDateInputValue } from "@/lib/date-range";

// Cada error tiene su mensaje en espanol: sin el, Zod devuelve el suyo en
// ingles cuando un campo no llega (entrega 10.5b). La fecha debe existir:
// new Date("2026-02-30T00:00:00") da el 2 de marzo sin avisar, y un texto llega
// a la base como fecha invalida.
const preventiveStatuses = ["pendiente", "realizado", "vencido", "anulado"];

export const preventiveMaintenanceSchema = z.object({
  id_maquina: z
    .string({ error: "Seleccione una máquina válida." })
    .trim()
    .length(11, "Seleccione una máquina válida."),

  fecha_programada: z
    .string({ error: "La fecha programada es obligatoria." })
    .trim()
    .min(1, "La fecha programada es obligatoria.")
    .refine(
      (value) => toDateInputValue(value) === value,
      "La fecha programada no es válida.",
    )
    .transform((value) => new Date(`${value}T00:00:00`)),

  responsable: z
    .string()
    .trim()
    .max(100, "El responsable no debe superar los 100 caracteres.")
    .optional()
    .or(z.literal("")),

  actividad: z
    .string({ error: "La actividad es obligatoria." })
    .trim()
    .min(5, "La actividad debe tener al menos 5 caracteres.")
    .max(255, "La actividad no debe superar los 255 caracteres."),

  estado: z
    .string({ error: "Seleccione un estado válido." })
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
    .string({ error: "El identificador del mantenimiento no es válido." })
    .trim()
    .length(11, "El identificador del mantenimiento no es válido."),

  estado: z
    .string({ error: "Seleccione un estado válido." })
    .trim()
    .refine(
      (value) => preventiveStatuses.includes(value),
      "Seleccione un estado válido.",
    ),
});