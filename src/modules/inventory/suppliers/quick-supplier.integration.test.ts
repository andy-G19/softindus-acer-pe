import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createQuickSupplierAction } from "@/modules/inventory/suppliers/actions";
import { getTestDatabase } from "@/testing/test-database";

// El alta rapida de proveedor contra Postgres real (PGlite), C1 de la 11.7d (D105). La accion
// busca la razon social dentro de su transaccion, despues de reservar el correlativo de proveedor:
// si el nombre ya existe, la transaccion se revierte y el contador queda como estaba (no se
// pierde un numero). Solo se reemplazan la sesion y la cache de Next.
//
// Lo que no se puede probar aqui: dos altas simultaneas con el mismo nombre. En Postgres la
// segunda espera el bloqueo del correlativo y despues ve la primera; PGlite atiende una sola
// transaccion a la vez (test-database.ts). Las altas van una tras otra.

vi.mock("@/lib/authz", () => ({
  getAuthorizedSession: async () => ({ user: { id: "USU00000001", name: "Andrea Prueba" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const USUARIO = "USU00000001";
const TIPO = "ferreteria-alta-rapida";

let prisma: PrismaClient;

beforeAll(async () => {
  ({ prisma } = await getTestDatabase());

  await prisma.rol.create({ data: { id_rol: "ROL00000001", nombre_rol: "ADMIN" } });
  await prisma.usuario.create({
    data: {
      id_usuario: USUARIO,
      id_rol: "ROL00000001",
      nombres: "Andrea",
      apellidos: "Prueba",
      usuario: "andrea",
      clave_hash: "sin-uso",
    },
  });
  await prisma.tipo_proveedor_catalogo.create({
    data: { id_tipo_proveedor: "TPR00009001", nombre: "Ferreteria (alta rapida)", slug: TIPO },
  });
});

async function counter() {
  const row = await prisma.correlativo_sistema.findUniqueOrThrow({
    where: { codigo_entidad: "proveedor" },
    select: { ultimo_numero: true },
  });

  return row.ultimo_numero;
}

describe("alta rapida de proveedor en Postgres", () => {
  it("crea el proveedor nuevo con el siguiente numero", async () => {
    const antes = await counter();

    const result = await createQuickSupplierAction({ razon_social: "Pernos del Valle", tipo_proveedor: TIPO });

    expect(result.ok).toBe(true);
    expect(await counter()).toBe(antes + 1);
    expect(await prisma.proveedor.count({ where: { razon_social: "Pernos del Valle" } })).toBe(1);
  });

  it("con el mismo nombre en otras mayusculas devuelve el existente y el contador no avanza", async () => {
    const primero = await prisma.proveedor.findFirstOrThrow({ where: { razon_social: "Pernos del Valle" } });
    const antes = await counter();

    const result = await createQuickSupplierAction({ razon_social: "PERNOS DEL VALLE", tipo_proveedor: TIPO });

    expect(result).toEqual({ ok: true, supplier: { id: primero.id_proveedor, label: "Pernos del Valle" } });
    expect(await counter()).toBe(antes);
    expect(
      await prisma.proveedor.count({ where: { razon_social: { equals: "pernos del valle", mode: "insensitive" } } }),
    ).toBe(1);
  });

  it("con un proveedor inactivo de ese nombre pide activarlo, sin crear ni avanzar el contador", async () => {
    const existente = await prisma.proveedor.findFirstOrThrow({ where: { razon_social: "Pernos del Valle" } });
    await prisma.proveedor.update({ where: { id_proveedor: existente.id_proveedor }, data: { estado: false } });
    const antes = await counter();

    const result = await createQuickSupplierAction({ razon_social: "Pernos del Valle", tipo_proveedor: TIPO });

    expect(result.ok).toBe(false);
    expect(await counter()).toBe(antes);
  });
});
