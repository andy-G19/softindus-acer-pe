import { z } from "zod";

export const sparePartSchema = z.object({
  id_proveedor: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || value.length === 11,
      "Seleccione un proveedor válido.",
    ),

  nombre_repuesto: z
    .string()
    .trim()
    .min(2, "El nombre del repuesto debe tener al menos 2 caracteres.")
    .max(100, "El nombre del repuesto no debe superar los 100 caracteres."),

  descripcion: z
    .string()
    .trim()
    .max(500, "La descripción no debe superar los 500 caracteres.")
    .optional()
    .or(z.literal("")),

  costo_unitario: z
    .string()
    .trim()
    .min(1, "El costo unitario es obligatorio.")
    .transform((value, ctx) => {
      const amount = Number(value);

      if (Number.isNaN(amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El costo unitario debe ser un número válido.",
        });

        return z.NEVER;
      }

      if (amount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El costo unitario no puede ser negativo.",
        });

        return z.NEVER;
      }

      return amount;
    }),

  estado: z
    .string()
    .trim()
    .refine(
      (value) => value === "true" || value === "false",
      "Seleccione un estado válido.",
    )
    .transform((value) => value === "true"),
});

export const sparePartStatusSchema = z.object({
  id_repuesto: z
    .string()
    .trim()
    .length(11, "El identificador del repuesto no es válido."),

  estado: z
    .string()
    .trim()
    .refine(
      (value) => value === "true" || value === "false",
      "Seleccione un estado válido.",
    )
    .transform((value) => value === "true"),
});