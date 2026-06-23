import { z } from "zod";

function optionalText(max: number) {
  return z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return value;
    },
    z.string().trim().max(max).optional(),
  );
}

function optionalNumber() {
  return z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return value;
    },
    z.coerce.number().min(0).optional(),
  );
}

function optionalEnum<T extends [string, ...string[]]>(values: T) {
  return z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return value;
    },
    z.enum(values).optional(),
  );
}

export const purchaseItemSchema = z.object({
  id_material: z.string().trim().min(1, "Seleccione un material."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor que cero."),
  unidad_medida: z
    .string()
    .trim()
    .min(1, "La unidad de medida es obligatoria.")
    .max(20),
  costo_unitario: z.coerce
    .number()
    .min(0, "El costo unitario no puede ser negativo."),
  observaciones: optionalText(300),
});

export const purchaseSchema = z.object({
  id_proveedor: z.string().trim().min(1, "Seleccione un proveedor."),

  fecha_compra: z
    .string()
    .trim()
    .min(1, "La fecha de compra es obligatoria."),

  tipo_comprobante: optionalEnum(["boleta", "factura", "recibo", "otro"]),

  numero_comprobante: optionalText(30),

  igv: optionalNumber(),

  observaciones: optionalText(500),

  items: z.array(purchaseItemSchema).min(1, "Agregue al menos un material."),
});