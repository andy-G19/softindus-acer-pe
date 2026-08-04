import { z } from "zod";

const MAX_CANTIDAD = 99999999.99;

/**
 * Entrega adicional: material que produccion necesita por encima de lo planificado.
 *
 * El motivo es obligatorio y con minimo de caracteres a proposito. Una salida de almacen
 * por encima del plan sin explicacion es exactamente el registro que nadie sabe
 * interpretar despues, y el que hace imposible auditar por que una orden consumio mas de
 * lo previsto.
 */
export const additionalDeliverySchema = z.object({
  id_orden_trabajo: z
    .string()
    .trim()
    .min(1, "No se recibió la orden de trabajo."),

  id_requerimiento: z
    .string()
    .trim()
    .min(1, "Selecciona el material a entregar."),

  cantidad: z.coerce
    .number({ message: "La cantidad debe ser numérica." })
    .positive("La cantidad debe ser mayor que cero.")
    .max(MAX_CANTIDAD, "La cantidad es demasiado alta."),

  motivo: z
    .string()
    .trim()
    .min(10, "Explica por qué se necesita material adicional (mínimo 10 caracteres).")
    .max(300, "El motivo no debe superar 300 caracteres."),
});

export type AdditionalDeliveryInput = z.infer<typeof additionalDeliverySchema>;

/**
 * Devolucion al almacen de material entregado y no usado.
 *
 * El motivo es opcional, al reves que en la entrega adicional: devolver material sobrante
 * es parte del flujo normal y no requiere justificacion.
 */
export const materialReturnSchema = z.object({
  id_orden_trabajo: z
    .string()
    .trim()
    .min(1, "No se recibió la orden de trabajo."),

  id_requerimiento: z
    .string()
    .trim()
    .min(1, "Selecciona el material a devolver."),

  cantidad: z.coerce
    .number({ message: "La cantidad debe ser numérica." })
    .positive("La cantidad debe ser mayor que cero.")
    .max(MAX_CANTIDAD, "La cantidad es demasiado alta."),

  motivo: z
    .string()
    .trim()
    .max(300, "El motivo no debe superar 300 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type MaterialReturnInput = z.infer<typeof materialReturnSchema>;

/**
 * Cierre de materiales de la orden.
 *
 * Se declara lo realmente consumido de cada material y las unidades producidas. La merma
 * NO se captura: sale por diferencia (entregado - consumido - devuelto).
 */
export const closeMaterialsSchema = z.object({
  id_orden_trabajo: z
    .string()
    .trim()
    .min(1, "No se recibió la orden de trabajo."),

  // Cero es válido: una orden puede fallar por completo y no producir ninguna unidad.
  cantidad_producida: z.coerce
    .number({ message: "La cantidad producida debe ser numérica." })
    .min(0, "La cantidad producida no puede ser negativa.")
    .max(MAX_CANTIDAD, "La cantidad producida es demasiado alta."),

  lineas: z
    .array(
      z.object({
        id_requerimiento: z.string().trim().min(1),
        cantidad_consumida: z.coerce
          .number({ message: "El consumo debe ser numérico." })
          .min(0, "El consumo no puede ser negativo.")
          .max(MAX_CANTIDAD, "El consumo es demasiado alto."),
      }),
    )
    .min(1, "La orden no tiene materiales que conciliar."),
});

export type CloseMaterialsInput = z.infer<typeof closeMaterialsSchema>;

/**
 * Reapertura del cierre de materiales.
 *
 * Reabrir NO deshace ningun movimiento de almacen: el cierre solo escribe declaraciones
 * (consumido, producido, fecha), mientras que lo que movio stock fueron las entregas y las
 * devoluciones, que quedan intactas. Por eso la operacion es segura: permite volver a
 * declarar sin revertir ninguna transaccion de inventario.
 *
 * El motivo es obligatorio porque reabrir habilita reescribir la merma declarada, que es
 * justamente el numero que a nadie le conviene que quede alto.
 */
export const reopenMaterialsSchema = z.object({
  id_orden_trabajo: z
    .string()
    .trim()
    .min(1, "No se recibió la orden de trabajo."),

  motivo: z
    .string()
    .trim()
    .min(10, "Explica por qué se reabre el cierre (mínimo 10 caracteres).")
    .max(300, "El motivo no debe superar 300 caracteres."),
});

export type ReopenMaterialsInput = z.infer<typeof reopenMaterialsSchema>;
