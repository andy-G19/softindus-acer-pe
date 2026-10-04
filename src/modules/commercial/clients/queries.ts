import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";

// Consultas de lectura de las paginas de Clientes. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

export type ClientListFilters = {
  client: string;
  q: string;
  type: string;
  status: string;
  origin: string;
};

function buildClientListWhere(
  filters: ClientListFilters,
): Prisma.clienteWhereInput | undefined {
  const { client, q, type, status, origin } = filters;
  const conditions: Prisma.clienteWhereInput[] = [];

  if (client) {
    conditions.push({ id_cliente: client });
  }

  if (q) {
    conditions.push({
      OR: [
        { nombre_razon_social: { contains: q, mode: "insensitive" } },
        { numero_documento: { contains: q, mode: "insensitive" } },
        { telefono: { contains: q, mode: "insensitive" } },
        { correo: { contains: q, mode: "insensitive" } },
        { direccion: { contains: q, mode: "insensitive" } },
        { lugar_origen: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (type) {
    conditions.push({ tipo_cliente: type });
  }

  if (status === "activo") {
    conditions.push({ estado: true });
  }

  if (status === "inactivo") {
    conditions.push({ estado: false });
  }

  if (origin) {
    conditions.push({
      lugar_origen: { contains: origin, mode: "insensitive" },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : undefined;
}

export async function getClientListData(
  filters: ClientListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const where = buildClientListWhere(filters);

  const [clientOptions, clients, totalItems] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: {
        nombre_razon_social: "asc",
      },
      select: {
        id_cliente: true,
        nombre_razon_social: true,
        tipo_cliente: true,
        numero_documento: true,
        telefono: true,
        lugar_origen: true,
      },
    }),
    prisma.cliente.findMany({
      where,
      orderBy: [{ fecha_registro: "desc" }, { id_cliente: "desc" }],
      skip,
      take,
    }),
    prisma.cliente.count({ where }),
  ]);

  return { clientOptions, clients, totalItems };
}

export async function getClientForEdit(idCliente: string) {
  return prisma.cliente.findUnique({
    where: {
      id_cliente: idCliente,
    },
    select: {
      id_cliente: true,
      tipo_cliente: true,
      nombre_razon_social: true,
      tipo_documento: true,
      numero_documento: true,
      telefono: true,
      correo: true,
      direccion: true,
      lugar_origen: true,
      observaciones: true,
    },
  });
}
