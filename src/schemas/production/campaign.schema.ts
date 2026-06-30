import { z } from "zod";

const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const requiredDateSchema = z
  .string()
  .trim()
  .min(1, "La fecha de inicio es obligatoria.")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
    message: "La fecha de inicio no es valida.",
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

      return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
    },
    {
      message: "La fecha de fin no es valida.",
    },
  );

export const productionCampaignSchema = z
  .object({
    nombre_campania: z
      .string()
      .trim()
      .min(1, "El nombre de la campania es obligatorio.")
      .max(100, "El nombre de la campania no debe superar 100 caracteres."),

    fecha_inicio: requiredDateSchema,

    fecha_fin: optionalDateSchema,

    objetivo_general: optionalTextSchema,

    estado: z.enum(["planificada", "activa", "finalizada", "anulada"]),
  })
  .refine(
    (data) => {
      if (!data.fecha_fin) {
        return true;
      }

      const startDate = new Date(`${data.fecha_inicio}T00:00:00`);
      const endDate = new Date(`${data.fecha_fin}T00:00:00`);

      return endDate >= startDate;
    },
    {
      message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
      path: ["fecha_fin"],
    },
  );

export const campaignDetailSchema = z.object({
  id_campania: z.string().trim().min(1, "La campania es obligatoria."),

  id_producto: z.string().trim().min(1, "El producto es obligatorio."),

  cantidad_objetivo: z.coerce
    .number()
    .positive("La cantidad objetivo debe ser mayor a cero.")
    .transform((value) => Number(value.toFixed(2))),

  observaciones: optionalTextSchema,
});
