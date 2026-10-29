import { z } from "zod";

const machineStatuses = [
  "operativa",
  "en_reparacion",
  "dada_de_baja",
  "inactiva",
];

// Cada error tiene su mensaje en espanol: sin el, Zod devuelve el suyo en
// ingles cuando un campo no llega (entrega 10.5a, como Comercial en la 10.4a).
export const machineSchema = z.object({
  nombre: z
    .string({ error: "El nombre de la máquina es obligatorio." })
    .trim()
    .min(2, "El nombre de la máquina debe tener al menos 2 caracteres.")
    .max(100, "El nombre de la máquina no debe superar los 100 caracteres."),

  tipo: z
    .string({ error: "El tipo de máquina es obligatorio." })
    .trim()
    .min(2, "El tipo de máquina debe tener al menos 2 caracteres.")
    .max(80, "El tipo de máquina no debe superar los 80 caracteres."),

  codigo_interno: z
    .string()
    .trim()
    .max(30, "El código interno no debe superar los 30 caracteres.")
    .optional()
    .or(z.literal("")),

  ubicacion: z
    .string()
    .trim()
    .max(100, "La ubicación no debe superar los 100 caracteres.")
    .optional()
    .or(z.literal("")),

  estado: z
    .string({ error: "Seleccione un estado válido para la máquina." })
    .trim()
    .refine(
      (value) => machineStatuses.includes(value),
      "Seleccione un estado válido para la máquina.",
    ),

  observaciones: z
    .string()
    .trim()
    .max(500, "Las observaciones no deben superar los 500 caracteres.")
    .optional()
    .or(z.literal("")),
});

export const machineStatusSchema = z.object({
  id_maquina: z
    .string()
    .trim()
    .length(11, "El identificador de la máquina no es válido."),

  estado: z
    .string()
    .trim()
    .refine(
      (value) => machineStatuses.includes(value),
      "Seleccione un estado válido para la máquina.",
    ),
});