import { z } from "zod";

import { cantidadRequeridaSchema } from "@/schemas/production/recipe-detail.schema";

const recipeVersionDetailSchema = z.object({
  id_material: z.string().trim().min(1, "Seleccione un material."),

  cantidad_requerida: cantidadRequeridaSchema,

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
  id_receta: z
    .string({ error: "La receta técnica es obligatoria." })
    .trim()
    .min(1, "La receta técnica es obligatoria."),

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
      details.forEach((detail, index) => {
        const uses = details.filter((other) => other.id_material === detail.id_material).length;

        if (detail.id_material && uses > 1) {
          ctx.addIssue({
            code: "custom",
            path: [index, "id_material"],
            message: "No se permite duplicar materiales dentro de la versión.",
          });
        }
      });
    }),
});

export const recipeVersionStatusSchema = z.object({
  id_receta: z
    .string({ error: "La receta técnica es obligatoria." })
    .trim()
    .min(1, "La receta técnica es obligatoria."),
  id_version_receta: z
    .string({ error: "La versión de receta es obligatoria." })
    .trim()
    .min(1, "La versión de receta es obligatoria."),
});

export type RecipeVersionInput = z.infer<typeof recipeVersionSchema>;
export type RecipeVersionStatusInput = z.infer<
  typeof recipeVersionStatusSchema
>;
