import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { toggleMaterialStatusAction } from "@/modules/inventory/materials/actions";

type MaterialsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function assertCanViewInventory(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function getStatusFilter(status: string) {
  if (status === "active") {
    return true;
  }

  if (status === "inactive") {
    return false;
  }

  return undefined;
}

export default async function MaterialsPage({
  searchParams,
}: MaterialsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  assertCanViewInventory(session.user.role);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const category = getSearchParam(params, "category");
  const unit = getSearchParam(params, "unit");
  const status = getSearchParam(params, "status");
  const stock = getSearchParam(params, "stock");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.materialWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_material: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_material: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (category) {
    filters.push({
      categoria: category,
    });
  }

  if (unit) {
    filters.push({
      unidad_medida: unit,
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.materialWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [materialsResult, categories, units] = await Promise.all([
    prisma.material.findMany({
      where,
      orderBy: {
        fecha_registro: "desc",
      },
    }),
    prisma.categoria_material.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        nombre: true,
        slug: true,
      },
    }),
    prisma.material.findMany({
      distinct: ["unidad_medida"],
      orderBy: {
        unidad_medida: "asc",
      },
      select: {
        unidad_medida: true,
      },
    }),
  ]);

  const materials = materialsResult.filter((material) => {
    const stockActual = Number(material.stock_actual.toString());
    const stockReservado = Number(material.stock_reservado.toString());
    const stockMinimo = Number(material.stock_minimo.toString());
    const stockDisponible = stockActual - stockReservado;
    const isCritical = stockMinimo > 0 && stockDisponible <= stockMinimo;

    if (stock === "critical") {
      return isCritical;
    }

    if (stock === "ok") {
      return !isCritical;
    }

    return true;
  });

  const isAdmin = session.user.role === "ADMIN";
  const categoryLabels = new Map(
    categories.map((item) => [item.slug, item.nombre]),
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Materiales
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Materiales e insumos
          </h1>
          <p className="text-slate-600">
            Consulta stock actual, stock reservado, stock mínimo y costo vigente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/inventory/material-categories"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Categorías
          </Link>

          {isAdmin ? (
            <Link
              href="/dashboard/inventory/materials/new"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Nuevo material
            </Link>
          ) : null}
        </div>
      </section>

      <form
        action="/dashboard/inventory/materials"
        className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto_auto]"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar material..."
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />

        <select
          name="category"
          defaultValue={category}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todas las categorías</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.nombre}
            </option>
          ))}
        </select>

        <select
          name="unit"
          defaultValue={unit}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todas las unidades</option>
          {units.map((item) => (
            <option key={item.unidad_medida} value={item.unidad_medida}>
              {item.unidad_medida}
            </option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>

        <select
          name="stock"
          defaultValue={stock}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todo el stock</option>
          <option value="critical">Críticos</option>
          <option value="ok">No críticos</option>
        </select>

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Filtrar
        </button>

        <Link
          href="/dashboard/inventory/materials"
          className="rounded-lg border px-4 py-2 text-center text-sm font-medium hover:bg-slate-50"
        >
          Limpiar filtros
        </Link>
      </form>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Unidad</th>
              <th className="px-4 py-3 font-semibold">Stock actual</th>
              <th className="px-4 py-3 font-semibold">Reservado</th>
              <th className="px-4 py-3 font-semibold">Disponible</th>
              <th className="px-4 py-3 font-semibold">Stock mínimo</th>
              <th className="px-4 py-3 font-semibold">Costo actual</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {materials.map((material) => {
              const stockActual = Number(material.stock_actual.toString());
              const stockReservado = Number(material.stock_reservado.toString());
              const stockMinimo = Number(material.stock_minimo.toString());
              const stockDisponible = stockActual - stockReservado;
              const isLowStock =
                stockMinimo > 0 && stockDisponible <= stockMinimo;

              return (
                <tr key={material.id_material} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {material.id_material}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {material.nombre_material}
                  </td>
                  <td className="px-4 py-3">
                    {categoryLabels.get(material.categoria) ??
                      material.categoria}
                  </td>
                  <td className="px-4 py-3">{material.unidad_medida}</td>
                  <td className="px-4 py-3">
                    {formatDecimal(material.stock_actual)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDecimal(material.stock_reservado)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        isLowStock
                          ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                          : "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                      }
                    >
                      {stockDisponible.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {formatDecimal(material.stock_minimo)}
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(material.costo_unitario_actual)}
                  </td>
                  <td className="px-4 py-3">
                    {material.estado ? "Activo" : "Inactivo"}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/inventory/materials/${material.id_material}/edit`}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium"
                        >
                          Editar
                        </Link>

                        <form action={toggleMaterialStatusAction}>
                          <input
                            type="hidden"
                            name="id_material"
                            value={material.id_material}
                          />
                          <button
                            type="submit"
                            className="rounded-md border px-3 py-1.5 text-xs font-medium"
                          >
                            {material.estado ? "Inactivar" : "Activar"}
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Solo lectura
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {materials.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay materiales registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
