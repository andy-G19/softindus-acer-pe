import { z } from "zod";

import { toDateInputValue } from "@/lib/date-range";

// C3 de la 11.5 (D58): una fecha debe existir, con la regla de la asistencia (hallazgo 68 de la
// 10.8a): new Date convierte el 30 de febrero en el 2 de marzo sin avisar y un texto que no es
// fecha llegaba a Prisma como fecha invalida. Un POST hecho a mano puede omitir el campo
// (formData.get devuelve null): el mensaje sigue en espanol.
const isRealDate = (value: string) => toDateInputValue(value) === value;

export const payrollSchema = z
  .object({
    id_operario: z
      .string()
      .trim()
      .min(1, "Debe seleccionar un operario."),

    periodo_inicio: z
      .string({ error: "La fecha de inicio del periodo es obligatoria." })
      .trim()
      .min(1, "La fecha de inicio del periodo es obligatoria.")
      .refine((value) => !value || isRealDate(value), "La fecha de inicio del periodo no es válida.")
      .transform((value) => new Date(`${value}T00:00:00`)),

    periodo_fin: z
      .string({ error: "La fecha de fin del periodo es obligatoria." })
      .trim()
      .min(1, "La fecha de fin del periodo es obligatoria.")
      .refine((value) => !value || isRealDate(value), "La fecha de fin del periodo no es válida.")
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