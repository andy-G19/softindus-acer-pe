import { z } from "zod";

// Cada error tiene su mensaje en espanol: sin el, Zod devuelve el suyo en
// ingles (entrega 10.4a).
export const clientSchema = z.object({
  tipo_cliente: z.enum(
    ["ferreteria", "distribuidora", "constructora", "cliente_final", "otro"],
    { error: "Selecciona un tipo de cliente válido." },
  ),
  nombre_razon_social: z
    .string({ error: "El nombre o razón social es obligatorio." })
    .min(2, "El nombre o razón social es obligatorio.")
    .max(150, "El nombre no debe superar 150 caracteres."),
  tipo_documento: z.union([z.enum(["dni", "ruc", "otro"]).optional(), z.literal("")], {
    error: "Selecciona un tipo de documento válido.",
  }),
  numero_documento: z.string().max(20, "El número de documento no debe superar 20 caracteres.").optional(),
  telefono: z.string().max(20, "El teléfono no debe superar 20 caracteres.").optional(),
  correo: z.string().email("Correo inválido.").optional().or(z.literal("")),
  direccion: z.string().max(150, "La dirección no debe superar 150 caracteres.").optional(),
  lugar_origen: z.string().max(100, "El lugar de origen no debe superar 100 caracteres.").optional(),
  observaciones: z.string().optional(),
});

export type ClientInput = z.infer<typeof clientSchema>;