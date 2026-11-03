import { z } from "zod";

// cantidad es numeric(10,2): un valor que la base redondea a cero dejaba el retazo sin
// cantidad, y uno mayor que la columna daba un error 500. El redondeo lo hace la base:
// toFixed daria 3.00 para 3.005, que la base guarda como 3.01.
const MAX_QUANTITY = 99_999_999.99;
const MIN_QUANTITY = 0.005;
const QUANTITY_REQUIRED = "La cantidad debe ser mayor que cero.";

export const reusableScrapSchema = z.object({
  id_material: z
    .string({ error: "Debe seleccionar un material de origen." })
    .trim()
    .min(1, "Debe seleccionar un material de origen.")
    .max(11, "El identificador del material no debe superar 11 caracteres."),

  id_orden_trabajo: z
    .string({ error: "Debe seleccionar la orden de trabajo que generó el retazo." })
    .trim()
    .min(1, "Debe seleccionar la orden de trabajo que generó el retazo.")
    .max(11, "El identificador de la orden no debe superar 11 caracteres."),

  medida_aproximada: z
    .string()
    .trim()
    .max(80, "La medida aproximada no debe superar 80 caracteres.")
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null)),

  cantidad: z.coerce
    .number({
      message: "La cantidad debe ser numérica.",
    })
    .max(MAX_QUANTITY, "La cantidad no debe superar 99,999,999.99.")
    .min(MIN_QUANTITY, QUANTITY_REQUIRED),

  unidad_medida: z
    .string({ error: "La unidad de medida es obligatoria." })
    .trim()
    .min(1, "La unidad de medida es obligatoria.")
    .max(20, "La unidad de medida no debe superar 20 caracteres."),

  ubicacion: z
    .string()
    .trim()
    .max(100, "La ubicación no debe superar 100 caracteres.")
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type ReusableScrapInput = z.infer<typeof reusableScrapSchema>;