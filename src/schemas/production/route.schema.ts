import { z } from "zod";

export const fabricationRouteSchema = z.object({
  id_producto: z
    .string()
    .trim()
    .min(1, "Seleccione un producto."),

  nombre_ruta: z
    .string()
    .trim()
    .min(3, "El nombre de la ruta debe tener al menos 3 caracteres.")
    .max(100, "El nombre de la ruta no debe superar 100 caracteres."),

  descripcion: z
    .string()
    .trim()
    .max(500, "La descripción no debe superar 500 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});