import { z } from "zod";

import { APP_ROLES } from "@/lib/permissions";

const ROLE_VALUES = Object.values(APP_ROLES) as [string, ...string[]];
const USER_STATUSES = ["activo", "inactivo"] as const;

const PASSWORD_RULES_MESSAGE =
  "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.";

// Reglas de contraseña: minimo 8 caracteres, al menos una mayuscula, una
// minuscula, un numero y un caracter especial. Nunca se acepta clave_hash
// desde el formulario: siempre se recibe la contraseña en texto plano aqui
// y se hashea recien en el Server Action, nunca se persiste tal cual.
const passwordSchema = z
  .string()
  .min(8, PASSWORD_RULES_MESSAGE)
  .refine((value) => /[A-Z]/.test(value), PASSWORD_RULES_MESSAGE)
  .refine((value) => /[a-z]/.test(value), PASSWORD_RULES_MESSAGE)
  .refine((value) => /[0-9]/.test(value), PASSWORD_RULES_MESSAGE)
  .refine((value) => /[^A-Za-z0-9]/.test(value), PASSWORD_RULES_MESSAGE);

const nombresSchema = z
  .string()
  .trim()
  .min(2, "Los nombres deben tener al menos 2 caracteres.")
  .max(100, "Los nombres no deben superar los 100 caracteres.");

const apellidosSchema = z
  .string()
  .trim()
  .min(2, "Los apellidos deben tener al menos 2 caracteres.")
  .max(100, "Los apellidos no deben superar los 100 caracteres.");

const usuarioSchema = z
  .string()
  .trim()
  .min(3, "El usuario debe tener al menos 3 caracteres.")
  .max(50, "El usuario no debe superar los 50 caracteres.");

const correoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Ingrese un correo electrónico válido.")
  .max(100, "El correo no debe superar los 100 caracteres.");

const rolSchema = z
  .string()
  .trim()
  .refine(
    (value) => ROLE_VALUES.includes(value),
    "Seleccione un rol válido.",
  );

const estadoSchema = z
  .string()
  .trim()
  .refine(
    (value) => USER_STATUSES.includes(value as (typeof USER_STATUSES)[number]),
    "Seleccione un estado válido.",
  );

export const createUserSchema = z
  .object({
    nombres: nombresSchema,
    apellidos: apellidosSchema,
    usuario: usuarioSchema,
    correo: correoSchema,
    rol: rolSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme la contraseña."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id_usuario: z.string().trim().min(1, "El usuario no existe."),
  nombres: nombresSchema,
  apellidos: apellidosSchema,
  usuario: usuarioSchema,
  correo: correoSchema,
  rol: rolSchema,
  estado: estadoSchema,
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetUserPasswordSchema = z
  .object({
    id_usuario: z.string().trim().min(1, "El usuario no existe."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme la contraseña."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
