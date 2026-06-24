import { z } from "zod";

const validCategories = [
  "luz",
  "desgaste_maquinaria",
  "transporte",
  "mantenimiento",
  "alquiler",
  "mano_obra_indirecta",
  "otros",
] as const;

export const indirectCostSchema = z.object({
  id_costeo: z
    .string()
    .trim()
    .min(1, "El costeo es obligatorio.")
    .max(11, "El identificador del costeo no debe superar 11 caracteres."),

  concepto: z
    .string()
    .trim()
    .min(3, "El concepto debe tener al menos 3 caracteres.")
    .max(100, "El concepto no debe superar 100 caracteres."),

  categoria: z.enum(validCategories, {
    message: "Debe seleccionar una categoría válida.",
  }),

  monto: z.coerce
    .number({
      message: "El monto debe ser numérico.",
    })
    .positive("El monto debe ser mayor que cero."),

  criterio_prorrateo: z
    .string()
    .trim()
    .max(100, "El criterio de prorrateo no debe superar 100 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  periodo: z
    .string()
    .trim()
    .max(30, "El periodo no debe superar 30 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  observaciones: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type IndirectCostInput = z.infer<typeof indirectCostSchema>;