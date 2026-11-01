import { z } from "zod";

import { toDateInputValue } from "@/lib/date-range";
import { toCents } from "@/lib/decimal-cents";

// Cada error tiene su mensaje en espanol: sin el, Zod devuelve el suyo en
// ingles cuando un campo no llega (entrega 10.5b). La fecha debe existir:
// new Date("2026-02-30T00:00:00") da el 2 de marzo sin avisar, y un texto llega
// a la base como fecha invalida. Los limites son los de las columnas:
// detalle_repuesto_reparacion.cantidad es numeric(10,2) y mano_obra, subtotal y
// costo_total, numeric(12,2); un valor mayor llegaba a la base y daba un error
// 500. El subtotal y el total dependen del costo del repuesto: los comprueba la
// accion. Los importes se leen con toCents, la funcion que los calcula: un
// texto que Number acepta y ella no (0x10) quedaria en cero sin avisar.
const MAX_QUANTITY = 99_999_999.99;
export const MAX_REPAIR_AMOUNT = 9_999_999_999.99;
const repairStatuses = ["programada", "ejecutada", "observada", "anulada"];

export const repairSchema = z.object({
  id_falla: z
    .string({ error: "Seleccione una falla válida." })
    .trim()
    .length(11, "Seleccione una falla válida."),

  fecha_reparacion: z
    .string({ error: "La fecha de reparación es obligatoria." })
    .trim()
    .min(1, "La fecha de reparación es obligatoria.")
    .refine(
      (value) => toDateInputValue(value) === value,
      "La fecha de reparación no es válida.",
    )
    .transform((value) => new Date(`${value}T00:00:00`)),

  tecnico_proveedor: z
    .string()
    .trim()
    .max(100, "El técnico o proveedor no debe superar los 100 caracteres.")
    .optional()
    .or(z.literal("")),

  mano_obra: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }

      const amount = Number(value);

      if (Number.isNaN(amount) || toCents(value) === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La mano de obra debe ser un número válido.",
        });

        return z.NEVER;
      }

      if (amount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La mano de obra no puede ser negativa.",
        });

        return z.NEVER;
      }

      if (amount > MAX_REPAIR_AMOUNT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La mano de obra no debe superar S/ 9,999,999,999.99.",
        });

        return z.NEVER;
      }

      return amount;
    }),

  estado_reparacion: z
    .string({ error: "Seleccione un estado de reparación válido." })
    .trim()
    .refine(
      (value) => repairStatuses.includes(value),
      "Seleccione un estado de reparación válido.",
    ),

  observaciones: z
    .string()
    .trim()
    .max(1000, "Las observaciones no deben superar los 1000 caracteres.")
    .optional()
    .or(z.literal("")),
});

export const repairSparePartSchema = z
  .object({
    id_repuesto: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => !value || value.length === 11,
        "Seleccione un repuesto válido.",
      ),

    cantidad: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .transform((value, ctx) => {
        if (!value) {
          return null;
        }

        const quantity = Number(value);

        if (Number.isNaN(quantity) || toCents(value) === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "La cantidad del repuesto debe ser un número válido.",
          });

          return z.NEVER;
        }

        // 0.001 es positivo, pero la base lo guardaria como cero.
        if (quantity <= 0 || toCents(value) === 0n) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "La cantidad del repuesto debe ser mayor a cero.",
          });

          return z.NEVER;
        }

        if (quantity > MAX_QUANTITY) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "La cantidad del repuesto no debe superar 99,999,999.99.",
          });

          return z.NEVER;
        }

        return quantity;
      }),
  })
  .superRefine((line, ctx) => {
    if (line.id_repuesto && !line.cantidad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cantidad"],
        message: "Ingrese la cantidad del repuesto.",
      });
    }

    if (!line.id_repuesto && line.cantidad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["id_repuesto"],
        message: "Seleccione el repuesto.",
      });
    }
  });

export const repairStatusSchema = z.object({
  id_reparacion: z
    .string({ error: "El identificador de la reparación no es válido." })
    .trim()
    .length(11, "El identificador de la reparación no es válido."),

  estado_reparacion: z
    .string({ error: "Seleccione un estado de reparación válido." })
    .trim()
    .refine(
      (value) => repairStatuses.includes(value),
      "Seleccione un estado de reparación válido.",
    ),
});