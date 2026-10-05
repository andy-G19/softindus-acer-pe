import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { findMaterialFilterOptions } from "@/modules/inventory/materials/queries";
import {
  findActiveSupplierOptions,
  findSupplierFilterOptions,
} from "@/modules/inventory/suppliers/queries";

// Consultas de lectura de las paginas de Proveedor-material. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export type SupplierMaterialListFilters = {
  supplier: string;
  material: string;
  availability: string;
  status: string;
};

function getStatusFilter(status: string) {
  if (status === "active") {
    return true;
  }

  if (status === "inactive") {
    return false;
  }

  return undefined;
}

function buildSupplierMaterialListWhere(
  filters: SupplierMaterialListFilters,
): Prisma.proveedor_materialWhereInput {
  const { supplier, material, availability, status } = filters;
  const statusFilter = getStatusFilter(status);
  const conditions: Prisma.proveedor_materialWhereInput[] = [];

  if (supplier) {
    conditions.push({
      id_proveedor: supplier,
    });
  }

  if (material) {
    conditions.push({
      id_material: material,
    });
  }

  if (availability) {
    conditions.push({
      disponibilidad: availability,
    });
  }

  if (statusFilter !== undefined) {
    conditions.push({
      estado: statusFilter,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getSupplierMaterialListData(
  filters: SupplierMaterialListFilters,
) {
  const where = buildSupplierMaterialListWhere(filters);

  const [relations, suppliers, materials] = await Promise.all([
    prisma.proveedor_material.findMany({
      where,
      orderBy: {
        fecha_actualizacion: "desc",
      },
      include: {
        proveedor: {
          select: {
            razon_social: true,
          },
        },
        material: {
          select: {
            nombre_material: true,
          },
        },
      },
    }),
    findSupplierFilterOptions(),
    findMaterialFilterOptions(),
  ]);

  return { relations, suppliers, materials };
}

export async function getNewSupplierMaterialFormOptions() {
  const [suppliers, materials] = await Promise.all([
    findActiveSupplierOptions(),
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        unidad_medida: true,
      },
    }),
  ]);

  return { suppliers, materials };
}

// Devuelve null si la relacion no existe; las opciones incluyen el proveedor y
// el material actuales aunque esten inactivos.
export async function getSupplierMaterialEditData(idProveedorMaterial: string) {
  const relation = await prisma.proveedor_material.findUnique({
    where: {
      id_proveedor_material: idProveedorMaterial,
    },
    include: {
      proveedor: true,
      material: true,
    },
  });

  if (!relation) {
    return null;
  }

  const [suppliers, materials] = await Promise.all([
    prisma.proveedor.findMany({
      where: {
        OR: [
          {
            estado: true,
          },
          {
            id_proveedor: relation.id_proveedor,
          },
        ],
      },
      orderBy: {
        razon_social: "asc",
      },
      select: {
        id_proveedor: true,
        razon_social: true,
      },
    }),
    prisma.material.findMany({
      where: {
        OR: [
          {
            estado: true,
          },
          {
            id_material: relation.id_material,
          },
        ],
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        unidad_medida: true,
      },
    }),
  ]);

  return { relation, suppliers, materials };
}
