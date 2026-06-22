import { z } from "zod";

export const orderItemSchema = z.object({
  id_producto: z.string().min(1, "Debes seleccionar un producto."),
  cantidad: z.coerce
    .number()
    .positive("La cantidad debe ser mayor que cero."),
  precio_unitario: z.coerce
    .number()
    .min(0, "El precio unitario no puede ser negativo."),
  observaciones: z
    .string()
    .max(300, "La observación del producto no debe superar 300 caracteres.")
    .optional(),
});

export const orderSchema = z.object({
  id_cliente: z.string().min(1, "Debes seleccionar un cliente."),

  fecha_entrega_estimada: z.string().optional(),

  observaciones: z
    .string()
    .max(500, "Las observaciones no deben superar 500 caracteres.")
    .optional(),

  items: z
    .array(orderItemSchema)
    .min(1, "El pedido debe tener al menos un producto."),
});

export type OrderInput = z.infer<typeof orderSchema>;