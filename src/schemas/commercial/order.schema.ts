import { z } from "zod";

import { toDateInputValue } from "@/lib/date-range";
import { calculateOrderAmounts } from "@/lib/order-amounts";

// Cada error tiene su mensaje en espanol: sin el, Zod devuelve el suyo en
// ingles (10.4c, como clientes y productos en la 10.4a). Los limites son los de
// las columnas: detalle_pedido.cantidad es numeric(10,2) y precio_unitario,
// subtotal y pedido.monto_estimado, numeric(12,2); un valor mayor llegaba a la
// base y daba un error 500. El subtotal y el monto se comprueban como se
// guardan (src/lib/order-amounts.ts), igual que una cantidad que la base
// redondearia a cero.
const MAX_QUANTITY = 99_999_999.99;
const MAX_AMOUNT = 9_999_999_999.99;
const QUANTITY_REQUIRED = "La cantidad debe ser mayor que cero.";

export const orderItemSchema = z.object({
  id_producto: z
    .string({ error: "Debes seleccionar un producto." })
    .min(1, "Debes seleccionar un producto."),
  cantidad: z.coerce
    .number({ error: "La cantidad debe ser un número." })
    .positive(QUANTITY_REQUIRED)
    .max(MAX_QUANTITY, "La cantidad no debe superar 99,999,999.99."),
  precio_unitario: z.coerce
    .number({ error: "El precio unitario debe ser un número." })
    .min(0, "El precio unitario no puede ser negativo.")
    .max(MAX_AMOUNT, "El precio unitario no debe superar S/ 9,999,999,999.99."),
  observaciones: z
    .string()
    .max(300, "La observación del producto no debe superar 300 caracteres.")
    .optional(),
});

export const orderSchema = z
  .object({
    id_cliente: z
      .string({ error: "Debes seleccionar un cliente." })
      .min(1, "Debes seleccionar un cliente."),

    // El valor de un input type="date": vacio o "aaaa-mm-dd" con una fecha que existe.
    fecha_entrega_estimada: z
      .string()
      .optional()
      .refine((value) => !value || toDateInputValue(value) === value, "La fecha estimada de entrega no es válida."),

    observaciones: z
      .string()
      .max(500, "Las observaciones no deben superar 500 caracteres.")
      .optional(),

    items: z
      .array(orderItemSchema, { error: "El pedido debe tener al menos un producto." })
      .min(1, "El pedido debe tener al menos un producto."),
  })
  .superRefine((data, context) => {
    const amounts = calculateOrderAmounts(data.items);
    let lineIssues = 0;

    amounts.lines.forEach((line, index) => {
      if (line.cantidad === "0.00") {
        lineIssues += 1;
        context.addIssue({ code: "custom", path: ["items", index, "cantidad"], message: QUANTITY_REQUIRED });
      }

      if (Number(line.subtotal) > MAX_AMOUNT) {
        lineIssues += 1;
        context.addIssue({
          code: "custom",
          path: ["items", index],
          message: "El subtotal de un producto no debe superar S/ 9,999,999,999.99.",
        });
      }
    });

    // Si una linea ya tiene su error, no se suma el del monto.
    if (lineIssues === 0 && Number(amounts.total) > MAX_AMOUNT) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "El monto estimado del pedido no debe superar S/ 9,999,999,999.99.",
      });
    }
  }, {
    // Solo con el resto del pedido valido: una cantidad o un precio fuera de
    // limite ya tiene su mensaje y no suma el del subtotal ni el del monto.
    when: (payload) => payload.issues.length === 0,
  });

export type OrderInput = z.infer<typeof orderSchema>;
