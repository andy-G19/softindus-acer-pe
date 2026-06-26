import { z } from "zod";

export const payrollSchema = z
  .object({
    id_operario: z
      .string()
      .trim()
      .min(1, "Debe seleccionar un operario."),

    periodo_inicio: z
      .string()
      .trim()
      .min(1, "La fecha de inicio del periodo es obligatoria.")
      .transform((value) => new Date(`${value}T00:00:00`)),

    periodo_fin: z
      .string()
      .trim()
      .min(1, "La fecha de fin del periodo es obligatoria.")
      .transform((value) => new Date(`${value}T00:00:00`)),

    descuentos: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .transform((value, ctx) => {
        if (!value) {
          return 0;
        }

        const amount = Number(value);

        if (Number.isNaN(amount)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El descuento debe ser un número válido.",
          });

          return z.NEVER;
        }

        if (amount < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El descuento no puede ser negativo.",
          });

          return z.NEVER;
        }

        return amount;
      }),
  })
  .superRefine((data, ctx) => {
    if (data.periodo_fin < data.periodo_inicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de fin no puede ser menor que la fecha de inicio.",
        path: ["periodo_fin"],
      });
    }
  });