import { z } from "zod";

function optionalText(max: number, maxMessage: string) {
  return z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return value;
    },
    z.string().trim().max(max, maxMessage).optional(),
  );
}

function optionalEnum<T extends [string, ...string[]]>(values: T, message: string) {
  return z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return value;
    },
    z.enum(values, { error: message }).optional(),
  );
}

export const supplierSchema = z.object({
  razon_social: z
    .string({ error: "La razón social es obligatoria." })
    .trim()
    .min(2, "La razón social es obligatoria.")
    .max(150, "La razón social no debe superar 150 caracteres."),

  tipo_documento: optionalEnum(["dni", "ruc", "otro"], "Selecciona un tipo de documento válido."),

  numero_documento: optionalText(20, "El número de documento no debe superar 20 caracteres."),

  telefono: optionalText(20, "El teléfono no debe superar 20 caracteres."),

  correo: z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return value;
    },
    z
      .string()
      .email("Ingrese un correo válido.")
      .max(100, "El correo no debe superar 100 caracteres.")
      .optional(),
  ),

  direccion: optionalText(150, "La dirección no debe superar 150 caracteres."),

  contacto_principal: optionalText(100, "El contacto principal no debe superar 100 caracteres."),

  tipo_proveedor: z
    .string({ error: "El tipo de proveedor es obligatorio." })
    .trim()
    .min(1, "El tipo de proveedor es obligatorio.")
    .max(80, "El tipo de proveedor no debe superar 80 caracteres."),

  condicion_pago: optionalEnum(
    ["contado", "credito", "parcial", "otro"],
    "Selecciona una condición de pago válida.",
  ),

  observaciones: optionalText(500, "Las observaciones no deben superar 500 caracteres."),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

/**
 * Alta rápida de proveedor desde otro formulario (por ejemplo, al registrar un
 * repuesto). Solo pide lo mínimo que exige el modelo; el resto de datos se
 * completa después desde el módulo Proveedores.
 */
export const quickSupplierSchema = z.object({
  razon_social: z
    .string({ error: "La razón social es obligatoria." })
    .trim()
    .min(2, "La razón social es obligatoria.")
    .max(150, "La razón social no debe superar 150 caracteres."),

  tipo_proveedor: z
    .string({ error: "El tipo de proveedor es obligatorio." })
    .trim()
    .min(1, "El tipo de proveedor es obligatorio.")
    .max(80, "El tipo de proveedor no debe superar 80 caracteres."),

  telefono: optionalText(20, "El teléfono no debe superar 20 caracteres."),
});

export type QuickSupplierInput = z.infer<typeof quickSupplierSchema>;
