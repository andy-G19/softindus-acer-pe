import { z } from "zod";

const repairStatuses = ["programada", "ejecutada", "observada", "anulada"];

function parseOptionalAmount(value: string, fieldName: string) {
  if (!value) {
    return null;
  }

  const amount = Number(value);

  if (Number.isNaN(amount)) {
    throw new Error(`${fieldName} debe ser un número válido.`);
  }

  if (amount < 0) {
    throw new Error(`${fieldName} no puede ser negativo.`);
  }

  return amount;
}

export const repairSchema = z.object({
  id_falla: z
    .string()
    .trim()
    .length(11, "Seleccione una falla válida."),

  fecha_reparacion: z
    .string()
    .trim()
    .min(1, "La fecha de reparación es obligatoria.")
    .transform((value) => new Date(`${value}T00:00:00`)),

  tecnico_proveedor: z
    .string()
    .trim()
    .max(100, "El técnico o proveedor no debe superar los 100 caracteres.")
    .optional()
    .or(z.literal("")),

  mano_obra: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      try {
        return parseOptionalAmount(value ?? "", "La mano de obra");
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            error instanceof Error
              ? error.message
              : "La mano de obra no es válida.",
        });

        return z.NEVER;
      }
    }),

  estado_reparacion: z
    .string()
    .trim()
    .refine(
      (value) => repairStatuses.includes(value),
      "Seleccione un estado de reparación válido.",
    ),

  observaciones: z
    .string()
    .trim()
    .max(1000, "Las observaciones no deben superar los 1000 caracteres.")
    .optional()
    .or(z.literal("")),
});

export const repairSparePartSchema = z.object({
  id_repuesto: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || value.length === 11,
      "Seleccione un repuesto válido.",
    ),

  cantidad: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }

      const quantity = Number(value);

      if (Number.isNaN(quantity)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La cantidad del repuesto debe ser un número válido.",
        });

        return z.NEVER;
      }

      if (quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La cantidad del repuesto debe ser mayor a cero.",
        });

        return z.NEVER;
      }

      return quantity;
    }),
});

export const repairStatusSchema = z.object({
  id_reparacion: z
    .string()
    .trim()
    .length(11, "El identificador de la reparación no es válido."),

  estado_reparacion: z
    .string()
    .trim()
    .refine(
      (value) => repairStatuses.includes(value),
      "Seleccione un estado de reparación válido.",
    ),
});