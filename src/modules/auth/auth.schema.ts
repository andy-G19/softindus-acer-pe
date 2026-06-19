import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Ingrese un correo electrónico válido."),

  password: z
    .string()
    .min(1, "Ingrese su contraseña."),
});

export type LoginInput = z.infer<typeof loginSchema>;