import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";

// Consultas de lectura de las paginas de Usuarios. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole. Ninguna devuelve clave_hash.

export type UserListFilters = {
  q: string;
  rol: string;
  estado: string;
};

function buildUserListWhere(filters: UserListFilters): Prisma.usuarioWhereInput {
  const { q, rol, estado } = filters;
  const conditions: Prisma.usuarioWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { nombres: { contains: q, mode: "insensitive" } },
        { apellidos: { contains: q, mode: "insensitive" } },
        { usuario: { contains: q, mode: "insensitive" } },
        { correo: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (rol) {
    conditions.push({ rol: { nombre_rol: rol } });
  }

  if (estado === "activo" || estado === "inactivo") {
    conditions.push({ estado });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getUserListData(
  filters: UserListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const where = buildUserListWhere(filters);

  const [users, totalItems, totalUsers, totalActive, totalInactive] =
    await Promise.all([
      prisma.usuario.findMany({
        where,
        orderBy: [{ fecha_registro: "desc" }, { id_usuario: "desc" }],
        skip,
        take,
        select: {
          id_usuario: true,
          nombres: true,
          apellidos: true,
          usuario: true,
          correo: true,
          estado: true,
          ultimo_acceso: true,
          fecha_registro: true,
          rol: {
            select: {
              nombre_rol: true,
            },
          },
        },
      }),
      prisma.usuario.count({ where }),
      prisma.usuario.count(),
      prisma.usuario.count({ where: { estado: "activo" } }),
      prisma.usuario.count({ where: { estado: "inactivo" } }),
    ]);

  return { users, totalItems, totalUsers, totalActive, totalInactive };
}

export async function getUserForEdit(idUsuario: string) {
  return prisma.usuario.findUnique({
    where: { id_usuario: idUsuario },
    select: {
      id_usuario: true,
      nombres: true,
      apellidos: true,
      usuario: true,
      correo: true,
      estado: true,
      rol: { select: { nombre_rol: true } },
    },
  });
}

export async function getUserForPasswordReset(idUsuario: string) {
  return prisma.usuario.findUnique({
    where: { id_usuario: idUsuario },
    select: {
      id_usuario: true,
      nombres: true,
      apellidos: true,
      correo: true,
    },
  });
}
