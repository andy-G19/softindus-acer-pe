import { z } from "zod";

// peso_kg y cantidad son numeric(10,2): un valor que la base redondea a cero dejaba el
// registro sin peso ni cantidad, y uno mayor que la columna daba un error 500. El
// redondeo lo hace la base: toFixed daria 3.00 para 3.005, que la base guarda como 3.01.
const MAX_QUANTITY = 99_999_999.99;
const MIN_QUANTITY = 0.005;
const VALUE_REQUIRED = "El valor debe ser mayor que cero.";

const optionalPositiveNumber = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    return value;
  },
  z.coerce
    .number({
      message: "El valor debe ser numérico.",
    })
    .max(MAX_QUANTITY, "El valor no debe superar 99,999,999.99.")
    .min(MIN_QUANTITY, VALUE_REQUIRED)
    .optional(),
);

export const scrapSchema = z
  .object({
    id_material: z
      .string()
      .trim()
      .nullish()
      .transform((value) => (value && value.length > 0 ? value : null)),

    // Opcional: la chatarra tambien nace fuera de una orden (limpieza de
    // taller, sobrantes de compra, desmontajes).
    id_orden_trabajo: z
      .string()
      .trim()
      .max(11, "El identificador de la orden no debe superar 11 caracteres.")
      .nullish()
      .transform((value) => (value && value.length > 0 ? value : null)),

    tipo_material: z
      .string({ error: "El tipo de material es obligatorio." })
      .trim()
      .min(2, "El tipo de material es obligatorio.")
      .max(50, "El tipo de material no debe superar 50 caracteres."),

    peso_kg: optionalPositiveNumber,

    cantidad: optionalPositiveNumber,

    observaciones: z
      .string()
      .trim()
      .nullish()
      .transform((value) => (value && value.length > 0 ? value : null)),
  })
  .refine((data) => data.peso_kg || data.cantidad, {
    message: "Debe registrar al menos peso en kg o cantidad aproximada.",
    path: ["peso_kg"],
    // Un valor rechazado ya tiene su mensaje: no suma este.
    when: (payload) => payload.issues.length === 0,
  });

export type ScrapInput = z.infer<typeof scrapSchema>;