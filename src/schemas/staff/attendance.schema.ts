import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

const optionalTimeSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || timeRegex.test(value),
    "La hora debe tener el formato HH:mm.",
  )
  .transform((value) => {
    if (!value) {
      return null;
    }

    return value;
  });

export const attendanceSchema = z
  .object({
    id_operario: z
      .string()
      .trim()
      .min(1, "Debe seleccionar un operario."),

    fecha: z
      .string()
      .trim()
      .min(1, "La fecha de asistencia es obligatoria.")
      .transform((value) => new Date(`${value}T00:00:00`)),

    hora_ingreso: optionalTimeSchema,

    hora_salida: optionalTimeSchema,

    tardanza: z.preprocess(
      (value) => value === "on" || value === true || value === "true",
      z.boolean(),
    ),

    falta: z.preprocess(
      (value) => value === "on" || value === true || value === "true",
      z.boolean(),
    ),

    observaciones: z
      .string()
      .trim()
      .max(500, "Las observaciones no deben superar los 500 caracteres.")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.falta && (data.hora_ingreso || data.hora_salida)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Si el operario tiene falta, no debe registrar hora de ingreso ni hora de salida.",
        path: ["falta"],
      });
    }

    if (!data.falta && !data.hora_ingreso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Si no marca falta, debe registrar al menos la hora de ingreso.",
        path: ["hora_ingreso"],
      });
    }

    if (data.hora_salida && !data.hora_ingreso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "No puede registrar hora de salida sin hora de ingreso.",
        path: ["hora_salida"],
      });
    }

    if (data.hora_ingreso && data.hora_salida) {
      const ingreso = timeToMinutes(data.hora_ingreso);
      const salida = timeToMinutes(data.hora_salida);

      if (salida <= ingreso) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "La hora de salida debe ser mayor que la hora de ingreso.",
          path: ["hora_salida"],
        });
      }
    }
  });