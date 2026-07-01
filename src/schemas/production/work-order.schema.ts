import { z } from "zod";

const optionalIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalTextSchema = z
  .string()
  .trim()
  .max(700, "Las observaciones no deben superar 700 caracteres.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const workOrderSchema = z
  .object({
    tipo_produccion: z.enum(["pedido", "campania", "reposicion_stock"]),

    id_detalle_pedido: optionalIdSchema,
    id_campania: optionalIdSchema,

    id_producto: optionalIdSchema,

    id_ruta: z
      .string()
      .trim()
      .min(1, "Seleccione una ruta de fabricación."),

    id_version_receta: z
      .string()
      .trim()
      .min(1, "Seleccione una versión de receta."),

    cantidad: z.coerce
      .number()
      .positive("La cantidad debe ser mayor a 0.")
      .max(999999.99, "La cantidad es demasiado alta."),

    fecha_inicio: z
      .string()
      .trim()
      .min(1, "La fecha de inicio es obligatoria.")
      .refine(
        (value) => !Number.isNaN(Date.parse(`${value}T00:00:00`)),
        "La fecha de inicio no es válida.",
      ),

    fecha_entrega_estimada: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null))
      .refine(
        (value) =>
          value === null ||
          value === undefined ||
          !Number.isNaN(Date.parse(`${value}T00:00:00`)),
        "La fecha estimada no es válida.",
      ),

    prioridad: z.enum(["alta", "media", "baja"]),

    observaciones: optionalTextSchema,
  })
  .superRefine((data, ctx) => {
    if (data.tipo_produccion === "pedido" && !data.id_detalle_pedido) {
      ctx.addIssue({
        code: "custom",
        path: ["id_detalle_pedido"],
        message: "Para una orden por pedido debe seleccionar un detalle de pedido.",
      });
    }

    if (data.tipo_produccion === "campania" && !data.id_campania) {
      ctx.addIssue({
        code: "custom",
        path: ["id_campania"],
        message: "Para una orden por campaña debe seleccionar una campaña.",
      });
    }

    if (
      (data.tipo_produccion === "campania" ||
        data.tipo_produccion === "reposicion_stock") &&
      !data.id_producto
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["id_producto"],
        message: "Seleccione un producto.",
      });
    }

    if (data.fecha_entrega_estimada) {
      const startDate = new Date(`${data.fecha_inicio}T00:00:00`);
      const estimatedDate = new Date(`${data.fecha_entrega_estimada}T00:00:00`);

      if (estimatedDate < startDate) {
        ctx.addIssue({
          code: "custom",
          path: ["fecha_entrega_estimada"],
          message:
            "La fecha estimada de entrega no puede ser anterior a la fecha de inicio.",
        });
      }
    }
  });
