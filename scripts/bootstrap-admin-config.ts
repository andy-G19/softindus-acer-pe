import { z } from "zod";

// Validacion pura de las variables BOOTSTRAP_ADMIN_*, sin ninguna
// dependencia de Prisma/Next ("server-only" no se puede resolver fuera del
// build de Next.js, ver scripts/bootstrap-admin.ts). Se mantiene separada
// para poder cubrirla con tests unitarios que no toquen la base de datos.

const CONFIRM_VALUE = "CREATE_INITIAL_ADMIN";

const PASSWORD_RULES_MESSAGE =
  "La contraseña debe tener al menos 12 caracteres, una mayúscula, una minúscula, un número y un carácter especial.";

// Mismas reglas de caracteres que src/schemas/users/user.schema.ts, pero con
// longitud minima elevada a 12 para la contraseña del primer administrador.
const passwordSchema = z
  .string()
  .min(12, PASSWORD_RULES_MESSAGE)
  .refine((value) => /[A-Z]/.test(value), PASSWORD_RULES_MESSAGE)
  .refine((value) => /[a-z]/.test(value), PASSWORD_RULES_MESSAGE)
  .refine((value) => /[0-9]/.test(value), PASSWORD_RULES_MESSAGE)
  .refine((value) => /[^A-Za-z0-9]/.test(value), PASSWORD_RULES_MESSAGE);

// Mismas reglas que nombresSchema/apellidosSchema/usuarioSchema/correoSchema
// de src/schemas/users/user.schema.ts.
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

const confirmSchema = z
  .string()
  .refine(
    (value) => value === CONFIRM_VALUE,
    `BOOTSTRAP_ADMIN_CONFIRM debe ser exactamente "${CONFIRM_VALUE}".`,
  );

export const bootstrapAdminConfigSchema = z.object({
  BOOTSTRAP_ADMIN_CONFIRM: confirmSchema,
  BOOTSTRAP_ADMIN_NAMES: nombresSchema,
  BOOTSTRAP_ADMIN_SURNAMES: apellidosSchema,
  BOOTSTRAP_ADMIN_USERNAME: usuarioSchema,
  BOOTSTRAP_ADMIN_EMAIL: correoSchema,
  BOOTSTRAP_ADMIN_PASSWORD: passwordSchema,
});

export type BootstrapAdminConfig = z.infer<typeof bootstrapAdminConfigSchema>;

export type BootstrapAdminConfigResult =
  | { success: true; data: BootstrapAdminConfig }
  | { success: false; errors: string[] };

type RawBootstrapAdminEnv = Record<string, string | undefined>;

// Nunca incluir el valor recibido en los mensajes de error (en particular la
// contraseña): solo se informa el nombre de la variable y la regla violada.
export function parseBootstrapAdminConfig(
  env: RawBootstrapAdminEnv,
): BootstrapAdminConfigResult {
  const parsed = bootstrapAdminConfigSchema.safeParse({
    BOOTSTRAP_ADMIN_CONFIRM: env.BOOTSTRAP_ADMIN_CONFIRM ?? "",
    BOOTSTRAP_ADMIN_NAMES: env.BOOTSTRAP_ADMIN_NAMES ?? "",
    BOOTSTRAP_ADMIN_SURNAMES: env.BOOTSTRAP_ADMIN_SURNAMES ?? "",
    BOOTSTRAP_ADMIN_USERNAME: env.BOOTSTRAP_ADMIN_USERNAME ?? "",
    BOOTSTRAP_ADMIN_EMAIL: env.BOOTSTRAP_ADMIN_EMAIL ?? "",
    BOOTSTRAP_ADMIN_PASSWORD: env.BOOTSTRAP_ADMIN_PASSWORD ?? "",
  });

  if (!parsed.success) {
    const errors = [
      ...new Set(
        parsed.error.issues.map(
          (issue) => `${String(issue.path[0] ?? "config")}: ${issue.message}`,
        ),
      ),
    ];

    return { success: false, errors };
  }

  return { success: true, data: parsed.data };
}
