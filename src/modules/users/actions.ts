"use server";

import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockUserRow } from "@/lib/row-locks";
import type { FieldErrors } from "@/lib/errors";
import { APP_ROLES } from "@/lib/permissions";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "@/schemas/users/user.schema";

/**
 * Lo que el formulario de usuario envio, para volver a mostrarlo. Nunca lleva la
 * contrasena ni su confirmacion: el resultado viaja al navegador y no debe
 * devolverlas (D6 de la 10.7); tras un error el usuario las vuelve a escribir.
 */
export type UserFormValues = {
  nombres: string;
  apellidos: string;
  usuario: string;
  correo: string;
  rol: string;
};

// Entrega 10.7b: el alta y la edicion se usan desde el panel lateral y devuelven
// el resultado; sin permiso responden con un error, no redirigen.
export type UserFormState = FormActionState<UserFormValues, { id_usuario: string }>;

// Entrega 10.7b: el restablecer se usa desde la ventana de la fila y devuelve el
// resultado. No devuelve valores: solo recibe contrasenas, que nunca vuelven (D6).
export type ResetPasswordFormState = FormActionState<Record<string, never>, { id_usuario: string }>;

const USERS_PATH = "/dashboard/users";
// Mismo costo usado en prisma/seed.ts y en src/auth.ts al validar login.
const BCRYPT_COST = 10;
const PERMISSION_ERROR = "No tienes permisos para gestionar usuarios.";
const INVALID_DATA = "Revisa los datos del usuario.";

function getUserFormValues(formData: FormData): UserFormValues {
  const text = (name: keyof UserFormValues) => formData.get(name)?.toString() ?? "";

  return {
    nombres: text("nombres"),
    apellidos: text("apellidos"),
    usuario: text("usuario"),
    correo: text("correo"),
    rol: text("rol"),
  };
}

function getPasswordFormData(formData: FormData) {
  return {
    password: formData.get("password")?.toString() ?? "",
    confirmPassword: formData.get("confirmPassword")?.toString() ?? "",
  };
}

function userError(values: UserFormValues, error: string, fieldErrors?: FieldErrors): UserFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function userSaved(values: UserFormValues, idUsuario: string): UserFormState {
  return { status: "success", data: { id_usuario: idUsuario }, values, operationId: newOperationId() };
}

function resetError(error: string, fieldErrors?: FieldErrors): ResetPasswordFormState {
  return { status: "error", error, fieldErrors, values: {}, operationId: newOperationId() };
}

/** Un problema que el formulario muestra: mensaje general y, si aplica, el del campo. */
type UserProblem = { error: string; fieldErrors?: FieldErrors };

function getResetPasswordFormData(formData: FormData) {
  return {
    id_usuario: formData.get("id_usuario")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
    confirmPassword: formData.get("confirmPassword")?.toString() ?? "",
  };
}

type UserReadClient = Pick<Prisma.TransactionClient, "usuario">;

/**
 * Busca si correo o usuario ya estan en uso por OTRO registro. Devuelve cual
 * de los dos campos esta duplicado, o null si no hay conflicto.
 */
async function findDuplicateUserField(
  client: UserReadClient,
  correo: string,
  usuario: string,
  currentUserId?: string,
): Promise<"correo" | "usuario" | null> {
  const existing = await client.usuario.findFirst({
    where: {
      OR: [{ correo }, { usuario }],
      ...(currentUserId ? { id_usuario: { not: currentUserId } } : {}),
    },
    select: {
      correo: true,
      usuario: true,
    },
  });

  if (!existing) {
    return null;
  }

  if (existing.correo === correo) {
    return "correo";
  }

  return "usuario";
}

function getPrismaUniqueProblem(error: unknown): UserProblem | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return {
      error: "Ya existe un usuario con ese correo o nombre de usuario.",
    };
  }

  return null;
}

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const values = getUserFormValues(formData);
  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return userError(values, PERMISSION_ERROR);
  }

  const parsed = createUserSchema.safeParse({ ...values, ...getPasswordFormData(formData) });

  if (!parsed.success) {
    return userError(values, INVALID_DATA, parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  const role = await prisma.rol.findUnique({
    where: { nombre_rol: data.rol },
    select: { id_rol: true },
  });

  if (!role) {
    return userError(values, "El rol seleccionado no es válido.", {
      rol: ["El rol seleccionado no es válido."],
    });
  }

  const duplicateField = await findDuplicateUserField(prisma, data.correo, data.usuario);

  if (duplicateField === "correo") {
    return userError(values, "Ya existe un usuario con ese correo.", {
      correo: ["Ya existe un usuario con ese correo."],
    });
  }

  if (duplicateField === "usuario") {
    return userError(values, "Ya existe un usuario con ese nombre de usuario.", {
      usuario: ["Ya existe un usuario con ese nombre de usuario."],
    });
  }

  // La contraseña en texto plano nunca se persiste ni se audita: solo se
  // usa aqui para calcular el hash.
  const claveHash = await bcrypt.hash(data.password, BCRYPT_COST);

  let idUsuario = "";

  try {
    await prisma.$transaction(async (tx) => {
      idUsuario = await getNextCorrelativeId(tx, {
        codigoEntidad: "usuario",
        prefijo: "USU",
      });

      await tx.usuario.create({
        data: {
          id_usuario: idUsuario,
          id_rol: role.id_rol,
          nombres: data.nombres,
          apellidos: data.apellidos,
          usuario: data.usuario,
          correo: data.correo,
          clave_hash: claveHash,
          estado: "activo",
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "usuario",
        id_registro_afectado: idUsuario,
        accion: "crear",
        detalle: `Usuario creado: ${data.correo}`,
        tx,
      });
    });
  } catch (error) {
    const uniqueProblem = getPrismaUniqueProblem(error);

    if (uniqueProblem) {
      return userError(values, uniqueProblem.error);
    }

    throw error;
  }

  revalidatePath(USERS_PATH);

  return userSaved(values, idUsuario);
}

export async function updateUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const values = getUserFormValues(formData);
  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return userError(values, PERMISSION_ERROR);
  }

  const parsed = updateUserSchema.safeParse({
    ...values,
    id_usuario: formData.get("id_usuario")?.toString() ?? "",
  });

  if (!parsed.success) {
    return userError(values, INVALID_DATA, parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  // La fila del usuario se bloquea antes de leer su rol: la regla de no quitarse
  // el rol propio y la bitacora del cambio deciden con lo guardado, y dos
  // ediciones simultaneas se ponen en fila (hallazgo 21 de la 10.7). Un rechazo
  // se devuelve desde la transaccion, que no llego a escribir. El estado no se
  // edita aqui: cambia desde la fila (D2).
  let problem: UserProblem | null;

  try {
    problem = await prisma.$transaction(async (tx): Promise<UserProblem | null> => {
      await lockUserRow(tx, data.id_usuario);

      const currentUser = await tx.usuario.findUnique({
        where: { id_usuario: data.id_usuario },
        select: {
          id_usuario: true,
          rol: { select: { nombre_rol: true } },
        },
      });

      if (!currentUser) {
        return { error: "El usuario no existe." };
      }

      const role = await tx.rol.findUnique({
        where: { nombre_rol: data.rol },
        select: { id_rol: true },
      });

      if (!role) {
        return {
          error: "El rol seleccionado no es válido.",
          fieldErrors: { rol: ["El rol seleccionado no es válido."] },
        };
      }

      // Un ADMIN no puede quitarse a si mismo el rol ADMIN: se quedaria sin
      // acceso al propio modulo de usuarios.
      if (
        data.id_usuario === session.user.id &&
        currentUser.rol.nombre_rol === APP_ROLES.ADMIN &&
        data.rol !== APP_ROLES.ADMIN
      ) {
        return {
          error: "No puedes quitarte tu propio rol de administrador.",
          fieldErrors: {
            rol: ["No puedes quitarte tu propio rol de administrador."],
          },
        };
      }

      const duplicateField = await findDuplicateUserField(
        tx,
        data.correo,
        data.usuario,
        data.id_usuario,
      );

      if (duplicateField === "correo") {
        return {
          error: "Ya existe otro usuario con ese correo.",
          fieldErrors: { correo: ["Ya existe otro usuario con ese correo."] },
        };
      }

      if (duplicateField === "usuario") {
        return {
          error: "Ya existe otro usuario con ese nombre de usuario.",
          fieldErrors: {
            usuario: ["Ya existe otro usuario con ese nombre de usuario."],
          },
        };
      }

      await tx.usuario.update({
        where: { id_usuario: data.id_usuario },
        data: {
          nombres: data.nombres,
          apellidos: data.apellidos,
          usuario: data.usuario,
          correo: data.correo,
          id_rol: role.id_rol,
        },
        select: { id_usuario: true },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "usuario",
        id_registro_afectado: data.id_usuario,
        accion: "actualizar",
        detalle: `Usuario actualizado: ${data.id_usuario}`,
        tx,
      });

      if (currentUser.rol.nombre_rol !== data.rol) {
        await registerAuditLog({
          userId: session.user.id,
          entidad_afectada: "usuario",
          id_registro_afectado: data.id_usuario,
          accion: "actualizar",
          detalle: `Rol de usuario actualizado: ${data.id_usuario} (${currentUser.rol.nombre_rol} -> ${data.rol})`,
          tx,
        });
      }

      return null;
    });
  } catch (error) {
    problem = getPrismaUniqueProblem(error);

    if (!problem) {
      throw error;
    }
  }

  if (problem) {
    return userError(values, problem.error, problem.fieldErrors);
  }

  revalidatePath(USERS_PATH);

  return userSaved(values, data.id_usuario);
}

const USER_STATUSES = ["activo", "inactivo"] as const;
type UserStatus = (typeof USER_STATUSES)[number];

function isUserStatus(value: string): value is UserStatus {
  return (USER_STATUSES as readonly string[]).includes(value);
}

// Activar y desactivar desde la fila (entrega 10.7b): una sola accion para
// ConfirmActionButton, que envia el estado pedido y recibe el resultado en lugar
// de una redireccion. Un rechazo no revalida: el repintado quitaria el boton, y su
// mensaje con el.
export async function updateUserStatusAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const idUsuario = formData.get("id_usuario")?.toString().trim() ?? "";
  const nextStatus = formData.get("estado")?.toString() ?? "";
  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return rowStatusError(idUsuario, PERMISSION_ERROR);
  }

  if (!idUsuario) {
    return rowStatusError(idUsuario, "El usuario no existe.");
  }

  if (!isUserStatus(nextStatus)) {
    return rowStatusError(idUsuario, "Selecciona un estado válido.");
  }

  // Un ADMIN no puede desactivarse a si mismo: la fila deshabilita el boton y
  // esta es la garantia real.
  if (nextStatus === "inactivo" && idUsuario === session.user.id) {
    return rowStatusError(idUsuario, "No puedes desactivar tu propio usuario.");
  }

  let problem: string | null;

  try {
    // Compare-and-set: la escritura misma comprueba que el usuario no tenga ya
    // ese estado, sin leerlo antes, y la bitacora va en la misma transaccion. Con
    // count 0 se lee solo para explicar el rechazo: no existe o ya lo tenia.
    problem = await prisma.$transaction(async (tx) => {
      const { count } = await tx.usuario.updateMany({
        where: { id_usuario: idUsuario, estado: { not: nextStatus } },
        data: { estado: nextStatus },
      });

      if (count === 0) {
        const exists = await tx.usuario.findUnique({
          where: { id_usuario: idUsuario },
          select: { id_usuario: true },
        });

        return exists ? `El usuario ya está ${nextStatus}.` : "El usuario no existe.";
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "usuario",
        id_registro_afectado: idUsuario,
        accion: nextStatus === "activo" ? "activar" : "inactivar",
        detalle: `Usuario ${nextStatus === "activo" ? "activado" : "desactivado"}: ${idUsuario}`,
        tx,
      });

      return null;
    });
  } catch {
    problem = "No se pudo cambiar el estado del usuario. Intenta nuevamente.";
  }

  if (problem) {
    return rowStatusError(idUsuario, problem);
  }

  revalidatePath(USERS_PATH);

  return rowStatusDone(idUsuario, nextStatus);
}

export async function resetUserPasswordAction(
  _prevState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return resetError(PERMISSION_ERROR);
  }

  const parsed = resetUserPasswordSchema.safeParse(
    getResetPasswordFormData(formData),
  );

  if (!parsed.success) {
    return resetError("Revisa la contraseña ingresada.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  // La contraseña nueva en texto plano nunca se persiste ni se audita: solo
  // se usa aqui para calcular el hash, antes de abrir la transaccion (bcrypt
  // tarda). Al actualizar clave_hash, la contraseña anterior deja de servir de
  // inmediato (auth.ts compara siempre contra el hash vigente en base de datos).
  const claveHash = await bcrypt.hash(data.password, BCRYPT_COST);

  // updateMany no devuelve la fila, que trae clave_hash, y su count dice si el
  // usuario existe; la bitacora va en la misma transaccion (hallazgos 18 y 22).
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.usuario.updateMany({
      where: { id_usuario: data.id_usuario },
      data: { clave_hash: claveHash },
    });

    if (count === 0) {
      return false;
    }

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "usuario",
      id_registro_afectado: data.id_usuario,
      accion: "actualizar",
      detalle: `Contraseña reiniciada para usuario: ${data.id_usuario}`,
      tx,
    });

    return true;
  });

  if (!updated) {
    return resetError("El usuario no existe.");
  }

  revalidatePath(USERS_PATH);

  return {
    status: "success",
    data: { id_usuario: data.id_usuario },
    values: {},
    operationId: newOperationId(),
  };
}
