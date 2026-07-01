import { z } from "zod";

const recipeVersionDetailSchema = z.object({
  id_material: z.string().trim().min(1, "Seleccione un material."),

  cantidad_requerida: z.coerce
    .number()
    .positive("La cantidad requerida debe ser mayor a 0.")
    .max(999999.99, "La cantidad requerida es demasiado alta."),

  tipo_consumo: z.enum(["materia_prima", "consumible", "auxiliar"], {
    message: "Seleccione un tipo de consumo válido.",
  }),

  merma_estimada_porcentaje: z.coerce
    .number({
      message: "La merma debe ser numérica.",
    })
    .min(0, "La merma no puede ser negativa.")
    .max(100, "La merma no puede superar 100%."),

  observaciones: z
    .string()
    .trim()
    .max(700, "Las observaciones no deben superar 700 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const recipeVersionSchema = z.object({
  id_receta: z.string().trim().min(1, "La receta técnica es obligatoria."),

  numero_version: z
    .string()
    .trim()
    .max(20, "El número de versión no debe superar 20 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  motivo_cambio: z
    .string()
    .trim()
    .max(700, "El motivo no debe superar 700 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  detalles: z
    .array(recipeVersionDetailSchema)
    .min(1, "Debe registrar al menos un material en la versión.")
    .superRefine((details, ctx) => {
      const materialIds = new Set<string>();

      details.forEach((detail, index) => {
        if (materialIds.has(detail.id_material)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "id_material"],
            message: "No se permite duplicar materiales dentro de la versión.",
          });
        }

        materialIds.add(detail.id_material);
      });
    }),
});

export const recipeVersionStatusSchema = z.object({
  id_receta: z.string().trim().min(1, "La receta técnica es obligatoria."),
  id_version_receta: z
    .string()
    .trim()
    .min(1, "La versión de receta es obligatoria."),
});

export type RecipeVersionInput = z.infer<typeof recipeVersionSchema>;
export type RecipeVersionStatusInput = z.infer<
  typeof recipeVersionStatusSchema
>;
