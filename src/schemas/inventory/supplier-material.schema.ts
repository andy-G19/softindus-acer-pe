import { z } from "zod";

function optionalNumber(invalidMessage: string, negativeMessage: string) {
  return z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return value;
    },
    z.coerce.number({ message: invalidMessage }).min(0, negativeMessage).optional(),
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

export const supplierMaterialSchema = z.object({
  id_proveedor: z.string({ error: "Seleccione un proveedor." }).trim().min(1, "Seleccione un proveedor."),
  id_material: z.string({ error: "Seleccione un material." }).trim().min(1, "Seleccione un material."),

  precio_referencial: optionalNumber(
    "El precio referencial debe ser numérico.",
    "El precio referencial no puede ser negativo.",
  ),

  unidad_medida: z
    .string({ error: "La unidad de medida es obligatoria." })
    .trim()
    .min(1, "La unidad de medida es obligatoria.")
    .max(20, "La unidad de medida no debe superar 20 caracteres."),

  tiempo_entrega_dias: optionalNumber(
    "El tiempo de entrega debe ser numérico.",
    "El tiempo de entrega no puede ser negativo.",
  ),

  disponibilidad: optionalEnum(
    ["alta", "media", "baja", "no_disponible"],
    "Selecciona una disponibilidad válida.",
  ),
});
