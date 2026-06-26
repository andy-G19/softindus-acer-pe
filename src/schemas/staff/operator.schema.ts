import { z } from "zod";

const paymentModes = ["semanal", "quincenal", "mensual"];
const operatorStatuses = ["activo", "inactivo"];

export const operatorSchema = z.object({
  nombres: z
    .string()
    .trim()
    .min(2, "Los nombres deben tener al menos 2 caracteres.")
    .max(100, "Los nombres no deben superar los 100 caracteres."),

  apellidos: z
    .string()
    .trim()
    .min(2, "Los apellidos deben tener al menos 2 caracteres.")
    .max(100, "Los apellidos no deben superar los 100 caracteres."),

  cargo: z
    .string()
    .trim()
    .max(50, "El cargo no debe superar los 50 caracteres.")
    .optional()
    .or(z.literal("")),

  especialidad: z
    .string()
    .trim()
    .max(80, "La especialidad no debe superar los 80 caracteres.")
    .optional()
    .or(z.literal("")),

  telefono: z
    .string()
    .trim()
    .max(20, "El teléfono no debe superar los 20 caracteres.")
    .optional()
    .or(z.literal("")),

  direccion: z
    .string()
    .trim()
    .max(150, "La dirección no debe superar los 150 caracteres.")
    .optional()
    .or(z.literal("")),

  modalidad_pago: z
    .string()
    .trim()
    .refine(
      (value) => paymentModes.includes(value),
      "Seleccione una modalidad de pago válida.",
    ),

  tarifa: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }

      const amount = Number(value);

      if (Number.isNaN(amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La tarifa debe ser un número válido.",
        });

        return z.NEVER;
      }

      if (amount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La tarifa no puede ser negativa.",
        });

        return z.NEVER;
      }

      return amount;
    }),

  fecha_ingreso: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => {
      if (!value) {
        return null;
      }

      return new Date(`${value}T00:00:00`);
    }),

  estado: z
    .string()
    .trim()
    .refine(
      (value) => operatorStatuses.includes(value),
      "Seleccione un estado válido.",
    ),

  observaciones: z
    .string()
    .trim()
    .max(500, "Las observaciones no deben superar los 500 caracteres.")
    .optional()
    .or(z.literal("")),
});