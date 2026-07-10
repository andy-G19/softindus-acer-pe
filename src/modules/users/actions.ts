"use server";

import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "@/schemas/users/user.schema";

export type UserFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const USERS_PATH = "/dashboard/users";
// Mismo costo usado en prisma/seed.ts y en src/auth.ts al validar login.
const BCRYPT_COST = 10;

function getCreateUserFormData(formData: FormData) {
  return {
    nombres: formData.get("nombres")?.toString() ?? "",
    apellidos: formData.get("apellidos")?.toString() ?? "",
    usuario: formData.get("usuario")?.toString() ?? "",
    correo: formData.get("correo")?.toString() ?? "",
    rol: formData.get("rol")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
    confirmPassword: formData.get("confirmPassword")?.toString() ?? "",
  };
}

function getUpdateUserFormData(formData: FormData) {
  return {
    id_usuario: formData.get("id_usuario")?.toString() ?? "",
    nombres: formData.get("nombres")?.toString() ?? "",
    apellidos: formData.get("apellidos")?.toString() ?? "",
    usuario: formData.get("usuario")?.toString() ?? "",
    correo: formData.get("correo")?.toString() ?? "",
    rol: formData.get("rol")?.toString() ?? "",
    estado: formData.get("estado")?.toString() ?? "",
  };
}

function getResetPasswordFormData(formData: FormData) {
  return {
    id_usuario: formData.get("id_usuario")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
    confirmPassword: formData.get("confirmPassword")?.toString() ?? "",
  };
}

/**
 * Busca si correo o usuario ya estan en uso por OTRO registro. Devuelve cual
 * de los dos campos esta duplicado, o null si no hay conflicto.
 */
async function findDuplicateUserField(
  correo: string,
  usuario: string,
  currentUserId?: string,
): Promise<"correo" | "usuario" | null> {
  const existing = await prisma.usuario.findFirst({
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

function getPrismaUniqueErrorState(error: unknown): UserFormState | null {
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
  const session = await requireRole([APP_ROLES.ADMIN]);

  const parsed = createUserSchema.safeParse(getCreateUserFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del usuario.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const role = await prisma.rol.findUnique({
    where: { nombre_rol: data.rol },
    select: { id_rol: true },
  });

  if (!role) {
    return {
      error: "El rol seleccionado no es válido.",
      fieldErrors: { rol: ["El rol seleccionado no es válido."] },
    };
  }

  const duplicateField = await findDuplicateUserField(data.correo, data.usuario);

  if (duplicateField === "correo") {
    return {
      error: "Ya existe un usuario con ese correo.",
      fieldErrors: { correo: ["Ya existe un usuario con ese correo."] },
    };
  }

  if (duplicateField === "usuario") {
    return {
      error: "Ya existe un usuario con ese nombre de usuario.",
      fieldErrors: {
        usuario: ["Ya existe un usuario con ese nombre de usuario."],
      },
    };
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
    const uniqueErrorState = getPrismaUniqueErrorState(error);

    if (uniqueErrorState) {
      return uniqueErrorState;
    }

    throw error;
  }

  revalidatePath(USERS_PATH);
  redirect(`${USERS_PATH}?toast=user-created`);
}

export async function updateUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const parsed = updateUserSchema.safeParse(getUpdateUserFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del usuario.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const currentUser = await prisma.usuario.findUnique({
    where: { id_usuario: data.id_usuario },
    select: {
      id_usuario: true,
      estado: true,
      rol: { select: { nombre_rol: true } },
    },
  });

  if (!currentUser) {
    return { error: "El usuario no existe." };
  }

  const role = await prisma.rol.findUnique({
    where: { nombre_rol: data.rol },
    select: { id_rol: true },
  });

  if (!role) {
    return {
      error: "El rol seleccionado no es válido.",
      fieldErrors: { rol: ["El rol seleccionado no es válido."] },
    };
  }

  const isSelf = data.id_usuario === session.user.id;

  // Un ADMIN no puede quitarse a si mismo el rol ADMIN (se quedaria sin
  // acceso al propio modulo de usuarios) ni desactivarse a si mismo.
  if (isSelf && currentUser.rol.nombre_rol === APP_ROLES.ADMIN && data.rol !== APP_ROLES.ADMIN) {
    return {
      error: "No puedes quitarte tu propio rol de administrador.",
      fieldErrors: {
        rol: ["No puedes quitarte tu propio rol de administrador."],
      },
    };
  }

  if (isSelf && data.estado !== "activo") {
    return {
      error: "No puedes desactivar tu propio usuario.",
      fieldErrors: { estado: ["No puedes desactivar tu propio usuario."] },
    };
  }

  const duplicateField = await findDuplicateUserField(
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

  const roleChanged = currentUser.rol.nombre_rol !== data.rol;
  const statusChanged = currentUser.estado !== data.estado;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id_usuario: data.id_usuario },
        data: {
          nombres: data.nombres,
          apellidos: data.apellidos,
          usuario: data.usuario,
          correo: data.correo,
          id_rol: role.id_rol,
          estado: data.estado,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "usuario",
        id_registro_afectado: data.id_usuario,
        accion: "actualizar",
        detalle: `Usuario actualizado: ${data.id_usuario}`,
        tx,
      });

      if (roleChanged) {
        await registerAuditLog({
          userId: session.user.id,
          entidad_afectada: "usuario",
          id_registro_afectado: data.id_usuario,
          accion: "actualizar",
          detalle: `Rol de usuario actualizado: ${data.id_usuario} (${currentUser.rol.nombre_rol} -> ${data.rol})`,
          tx,
        });
      }

      if (statusChanged) {
        await registerAuditLog({
          userId: session.user.id,
          entidad_afectada: "usuario",
          id_registro_afectado: data.id_usuario,
          accion: data.estado === "activo" ? "activar" : "inactivar",
          detalle: `Usuario ${data.estado === "activo" ? "activado" : "desactivado"}: ${data.id_usuario}`,
          tx,
        });
      }
    });
  } catch (error) {
    const uniqueErrorState = getPrismaUniqueErrorState(error);

    if (uniqueErrorState) {
      return uniqueErrorState;
    }

    throw error;
  }

  revalidatePath(USERS_PATH);
  redirect(`${USERS_PATH}?toast=user-updated`);
}

async function setUserStatus(formData: FormData, nextStatus: "activo" | "inactivo") {
  const session = await requireRole([APP_ROLES.ADMIN]);
  const idUsuario = formData.get("id_usuario")?.toString().trim();

  if (!idUsuario) {
    redirect(USERS_PATH);
  }

  // Un ADMIN no puede desactivarse a si mismo, ni siquiera desde el boton
  // rapido del listado (la UI ya lo deshabilita, esto es el respaldo real).
  if (nextStatus === "inactivo" && idUsuario === session.user.id) {
    redirect(`${USERS_PATH}?toast=user-self-deactivate-blocked`);
  }

  const user = await prisma.usuario.findUnique({
    where: { id_usuario: idUsuario },
    select: { id_usuario: true, estado: true },
  });

  if (!user) {
    redirect(USERS_PATH);
  }

  if (user.estado === nextStatus) {
    redirect(USERS_PATH);
  }

  await prisma.usuario.update({
    where: { id_usuario: idUsuario },
    data: { estado: nextStatus },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "usuario",
    id_registro_afectado: idUsuario,
    accion: nextStatus === "activo" ? "activar" : "inactivar",
    detalle: `Usuario ${nextStatus === "activo" ? "activado" : "desactivado"}: ${idUsuario}`,
  });

  revalidatePath(USERS_PATH);
  redirect(
    `${USERS_PATH}?toast=${nextStatus === "activo" ? "user-activated" : "user-deactivated"}`,
  );
}

export async function activateUserAction(formData: FormData) {
  await setUserStatus(formData, "activo");
}

export async function deactivateUserAction(formData: FormData) {
  await setUserStatus(formData, "inactivo");
}

export async function resetUserPasswordAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const parsed = resetUserPasswordSchema.safeParse(
    getResetPasswordFormData(formData),
  );

  if (!parsed.success) {
    return {
      error: "Revisa la contraseña ingresada.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const user = await prisma.usuario.findUnique({
    where: { id_usuario: data.id_usuario },
    select: { id_usuario: true },
  });

  if (!user) {
    return { error: "El usuario no existe." };
  }

  // La contraseña nueva en texto plano nunca se persiste ni se audita: solo
  // se usa aqui para calcular el hash. Al actualizar clave_hash, la
  // contraseña anterior deja de servir de inmediato (auth.ts compara
  // siempre contra el hash vigente en base de datos).
  const claveHash = await bcrypt.hash(data.password, BCRYPT_COST);

  await prisma.usuario.update({
    where: { id_usuario: data.id_usuario },
    data: { clave_hash: claveHash },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "usuario",
    id_registro_afectado: data.id_usuario,
    accion: "actualizar",
    detalle: `Contraseña reiniciada para usuario: ${data.id_usuario}`,
  });

  revalidatePath(USERS_PATH);
  redirect(`${USERS_PATH}?toast=user-password-reset`);
}
