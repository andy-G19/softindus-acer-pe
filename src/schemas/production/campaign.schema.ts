import { z } from "zod";

import { toDateInputValue } from "@/lib/date-range";

// Cada error tiene su mensaje en espanol: sin el, Zod devuelve el suyo en ingles.
// campania_detalle.cantidad_objetivo es numeric(10,2): un valor mayor llegaba a la
// base y daba un error 500, y uno que se redondea a cero se guardaba como cero.
const MAX_QUANTITY = 99_999_999.99;
const QUANTITY_REQUIRED = "La cantidad objetivo debe ser mayor a cero.";

const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

// El valor de un input type="date": "aaaa-mm-dd" con una fecha que existe. new Date
// convierte el 30 de febrero en el 2 de marzo sin avisar.
const isRealDate = (value: string) => toDateInputValue(value) === value;

const requiredDateSchema = z
  .string({ error: "La fecha de inicio es obligatoria." })
  .trim()
  .min(1, "La fecha de inicio es obligatoria.")
  .refine(isRealDate, {
    message: "La fecha de inicio no es válida.",
  });

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine(
    (value) => {
      if (!value) {
        return true;
      }

      return isRealDate(value);
    },
    {
      message: "La fecha de fin no es válida.",
    },
  );

const campaignFields = z.object({
  nombre_campania: z
    .string({ error: "El nombre de la campaña es obligatorio." })
    .trim()
    .min(1, "El nombre de la campaña es obligatorio.")
    .max(100, "El nombre de la campaña no debe superar 100 caracteres."),

  fecha_inicio: requiredDateSchema,

  fecha_fin: optionalDateSchema,

  objetivo_general: optionalTextSchema,
});

// Una fecha que no existe ya tiene su mensaje. Como texto aaaa-mm-dd, el orden
// alfabetico es el de las fechas.
function endsAfterStart(data: { fecha_inicio: string; fecha_fin: string | null }) {
  if (!data.fecha_fin || !isRealDate(data.fecha_inicio) || !isRealDate(data.fecha_fin)) {
    return true;
  }

  return data.fecha_fin >= data.fecha_inicio;
}

const END_AFTER_START = {
  message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
  path: ["fecha_fin"],
};

// Una campana nace planificada o activa. Finalizar y anular son acciones de la fila,
// con sus reglas, su fecha de fin y su bitacora (D2 de la 10.7).
export const productionCampaignSchema = campaignFields
  .extend({
    estado: z.enum(["planificada", "activa"], {
      error: "Selecciona un estado válido.",
    }),
  })
  .refine(endsAfterStart, END_AFTER_START);

export const updateProductionCampaignSchema = campaignFields.refine(endsAfterStart, END_AFTER_START);

export const campaignDetailSchema = z.object({
  id_campania: z
    .string({ error: "La campaña es obligatoria." })
    .trim()
    .min(1, "La campaña es obligatoria."),

  id_producto: z
    .string({ error: "El producto es obligatorio." })
    .trim()
    .min(1, "El producto es obligatorio."),

  cantidad_objetivo: z.coerce
    .number({ error: "La cantidad objetivo debe ser un número." })
    .positive(QUANTITY_REQUIRED)
    .max(MAX_QUANTITY, "La cantidad objetivo no debe superar 99,999,999.99.")
    .transform((value) => Number(value.toFixed(2)))
    .refine((value) => value > 0, QUANTITY_REQUIRED),

  observaciones: optionalTextSchema,
});
