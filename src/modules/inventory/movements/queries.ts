import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";
import { buildDateRangeFilter } from "@/lib/search-params";
import { findMaterialFilterOptions } from "@/modules/inventory/materials/queries";
import { findPurchaseFilterOptions } from "@/modules/inventory/purchases/queries";
import { findSupplierFilterOptions } from "@/modules/inventory/suppliers/queries";

// Consultas de lectura de las paginas de Entradas y Salidas de inventario. No
// autorizan: la pagina que las llama ya verifico el rol con requireRole.

export type InventoryEntryListFilters = {
  q: string;
  material: string;
  supplier: string;
  purchase: string;
  from: Date | null;
  to: Date | null;
};

function buildInventoryEntryListWhere(
  filters: InventoryEntryListFilters,
): Prisma.movimiento_inventarioWhereInput {
  const { q, material, supplier, purchase, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.movimiento_inventarioWhereInput[] = [
    { tipo_movimiento: "entrada" },
  ];

  if (q) {
    conditions.push({
      OR: [
        { id_compra: { contains: q, mode: "insensitive" } },
        { material: { nombre_material: { contains: q, mode: "insensitive" } } },
        {
          compra: {
            proveedor: {
              razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (material) {
    conditions.push({ id_material: material });
  }

  if (supplier) {
    conditions.push({ compra: { id_proveedor: supplier } });
  }

  if (purchase) {
    conditions.push({ id_compra: purchase });
  }

  if (dateRange) {
    conditions.push({ fecha_movimiento: dateRange });
  }

  return { AND: conditions };
}

export async function getInventoryEntryListData(
  filters: InventoryEntryListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const where = buildInventoryEntryListWhere(filters);

  const [movements, totalItems, materials, suppliers, purchases] =
    await Promise.all([
      prisma.movimiento_inventario.findMany({
        where,
        orderBy: [{ fecha_movimiento: "desc" }, { id_movimiento: "desc" }],
        skip,
        take,
        include: {
          material: true,
          compra: {
            include: {
              proveedor: true,
            },
          },
        },
      }),
      prisma.movimiento_inventario.count({ where }),
      findMaterialFilterOptions(),
      findSupplierFilterOptions(),
      findPurchaseFilterOptions(),
    ]);

  return { movements, totalItems, materials, suppliers, purchases };
}

export type InventoryOutputListFilters = {
  q: string;
  material: string;
  order: string;
  from: Date | null;
  to: Date | null;
};

function buildInventoryOutputListWhere(
  filters: InventoryOutputListFilters,
): Prisma.movimiento_inventarioWhereInput {
  const { q, material, order, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.movimiento_inventarioWhereInput[] = [
    { tipo_movimiento: "salida" },
  ];

  if (q) {
    conditions.push({
      OR: [
        { id_orden_trabajo: { contains: q, mode: "insensitive" } },
        { material: { nombre_material: { contains: q, mode: "insensitive" } } },
        { usuario: { usuario: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (material) {
    conditions.push({ id_material: material });
  }

  if (order) {
    conditions.push({ id_orden_trabajo: order });
  }

  if (dateRange) {
    conditions.push({ fecha_movimiento: dateRange });
  }

  return { AND: conditions };
}

export async function getInventoryOutputListData(
  filters: InventoryOutputListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const where = buildInventoryOutputListWhere(filters);

  const [movements, totalItems, materials, workOrders] = await Promise.all([
    prisma.movimiento_inventario.findMany({
      where,
      orderBy: [{ fecha_movimiento: "desc" }, { id_movimiento: "desc" }],
      skip,
      take,
      include: {
        material: true,
        usuario: {
          select: {
            usuario: true,
          },
        },
      },
    }),
    prisma.movimiento_inventario.count({ where }),
    findMaterialFilterOptions(),
    prisma.orden_trabajo.findMany({
      orderBy: { fecha_inicio: "desc" },
      select: { id_orden_trabajo: true },
    }),
  ]);

  return { movements, totalItems, materials, workOrders };
}

export async function getInventoryOutputFormOptions() {
  const [materials, workOrders] = await Promise.all([
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
        stock_actual: true,
        stock_reservado: true,
      },
    }),
    // Solo las ordenes que admiten material, con la misma regla que valida la salida (H9).
    prisma.orden_trabajo.findMany({
      where: {
        estado: {
          notIn: ["finalizada", "anulada"],
        },
        fecha_cierre_materiales: null,
      },
      orderBy: {
        fecha_inicio: "desc",
      },
      select: {
        id_orden_trabajo: true,
        estado: true,
      },
    }),
  ]);

  return { materials, workOrders };
}
