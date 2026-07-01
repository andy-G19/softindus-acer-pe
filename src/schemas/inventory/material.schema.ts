import { z } from "zod";

const materialBaseSchema = z.object({
  nombre_material: z
    .string()
    .trim()
    .min(2, "El nombre del material es obligatorio.")
    .max(100, "El nombre del material no debe superar 100 caracteres."),

  categoria: z
    .string()
    .trim()
    .min(1, "La categoría es obligatoria.")
    .max(80, "La categoría no debe superar 80 caracteres."),

  unidad_medida: z
    .string()
    .trim()
    .min(1, "La unidad de medida es obligatoria.")
    .max(20, "La unidad de medida no debe superar 20 caracteres."),

  stock_minimo: z.coerce
    .number({
      message: "El stock mínimo debe ser numérico.",
    })
    .min(0, "El stock mínimo no puede ser negativo."),

  costo_unitario_actual: z.coerce
    .number({
      message: "El costo unitario debe ser numérico.",
    })
    .min(0, "El costo unitario no puede ser negativo."),
});

export const materialSchema = materialBaseSchema
  .extend({
    stock_actual: z.coerce
      .number({
        message: "El stock actual debe ser numérico.",
      })
      .min(0, "El stock actual no puede ser negativo."),

    stock_reservado: z.coerce
      .number({
        message: "El stock reservado debe ser numérico.",
      })
      .min(0, "El stock reservado no puede ser negativo."),
  })
  .refine((data) => data.stock_actual >= data.stock_reservado, {
    message: "El stock actual no puede ser menor que el stock reservado.",
    path: ["stock_actual"],
  });

export const materialUpdateSchema = materialBaseSchema;

export type MaterialInput = z.infer<typeof materialSchema>;
export type MaterialUpdateInput = z.infer<typeof materialUpdateSchema>;
