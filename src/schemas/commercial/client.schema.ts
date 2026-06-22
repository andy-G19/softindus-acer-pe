import { z } from "zod";

export const clientSchema = z.object({
  tipo_cliente: z.enum([
    "ferreteria",
    "distribuidora",
    "constructora",
    "cliente_final",
    "otro",
  ]),
  nombre_razon_social: z
    .string()
    .min(2, "El nombre o razón social es obligatorio.")
    .max(150, "El nombre no debe superar 150 caracteres."),
  tipo_documento: z
    .enum(["dni", "ruc", "otro"])
    .optional()
    .or(z.literal("")),
  numero_documento: z.string().max(20).optional(),
  telefono: z.string().max(20).optional(),
  correo: z.string().email("Correo inválido.").optional().or(z.literal("")),
  direccion: z.string().max(150).optional(),
  lugar_origen: z.string().max(100).optional(),
  observaciones: z.string().optional(),
});

export type ClientInput = z.infer<typeof clientSchema>;