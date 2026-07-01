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

export const supplierSchema = z.object({
  razon_social: z
    .string()
    .trim()
    .min(2, "La razón social es obligatoria.")
    .max(150, "La razón social no debe superar 150 caracteres."),

  tipo_documento: optionalEnum(["dni", "ruc", "otro"]),

  numero_documento: optionalText(20),

  telefono: optionalText(20),

  correo: z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return value;
    },
    z.string().email("Ingrese un correo válido.").max(100).optional(),
  ),

  direccion: optionalText(150),

  contacto_principal: optionalText(100),

  tipo_proveedor: z
    .string()
    .trim()
    .min(1, "El tipo de proveedor es obligatorio.")
    .max(80, "El tipo de proveedor no debe superar 80 caracteres."),

  condicion_pago: optionalEnum(["contado", "credito", "parcial", "otro"]),

  observaciones: optionalText(500),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
