import { z } from "zod";

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

export const supplierMaterialSchema = z.object({
  id_proveedor: z.string().trim().min(1, "Seleccione un proveedor."),
  id_material: z.string().trim().min(1, "Seleccione un material."),

  precio_referencial: optionalNumber(),

  unidad_medida: z
    .string()
    .trim()
    .min(1, "La unidad de medida es obligatoria.")
    .max(20, "La unidad de medida no debe superar 20 caracteres."),

  tiempo_entrega_dias: optionalNumber(),

  disponibilidad: optionalEnum([
    "alta",
    "media",
    "baja",
    "no_disponible",
  ]),
});