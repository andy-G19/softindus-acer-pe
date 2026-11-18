import { z } from "zod";

import { hasCents } from "@/lib/client-payment-amounts";

// C4 de la 11.7d (D109): cantidad_vendida y peso_vendido_kg son numeric(10,2). Lo que la base
// redondea a 0.00 (menos de 0.005) tampoco es un peso ni una cantidad, como en scrap.schema.ts. El
// redondeo lo hace la base: aqui no se redondea.
const MIN_QUANTITY = 0.005;

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
    .min(MIN_QUANTITY, "El valor debe ser mayor que cero.")
    .optional(),
);

export const scrapSaleSchema = z.object({
  id_chatarra: z
    .string()
    .trim()
    .min(1, "Debe seleccionar un registro de chatarra.")
    .max(11, "El identificador de chatarra no debe superar 11 caracteres."),

  id_caja_chica: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  fecha_venta: z
    .string()
    .trim()
    .min(1, "La fecha de venta es obligatoria."),

  cantidad_vendida: optionalPositiveNumber,

  peso_vendido_kg: optionalPositiveNumber,

  monto_recibido: z.coerce
    .number({
      message: "El monto recibido debe ser numérico.",
    })
    .positive("El monto recibido debe ser mayor que cero.")
    // C2 de la 11.4b (D48): lo que la columna guardaria como 0.00 tampoco es un monto. Solo mira
    // los positivos: la accion une los mensajes y un cero los repetiria.
    .refine((value) => value <= 0 || hasCents(value), "El monto recibido debe ser mayor que cero."),

  destino_dinero: z
    .string()
    .trim()
    .max(150, "El destino del dinero no debe superar 150 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  observaciones: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type ScrapSaleInput = z.infer<typeof scrapSaleSchema>;