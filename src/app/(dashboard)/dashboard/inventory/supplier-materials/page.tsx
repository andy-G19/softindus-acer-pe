import Link from "next/link";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { toggleSupplierMaterialStatusAction } from "@/modules/inventory/supplier-materials/actions";

type SupplierMaterialsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
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

function getAvailabilityLabel(value: string | null) {
  const labels: Record<string, string> = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
    no_disponible: "No disponible",
  };

  return value ? labels[value] ?? value : "-";
}

export default async function SupplierMaterialsPage({
  searchParams,
}: SupplierMaterialsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const supplier = getSearchParam(params, "supplier");
  const material = getSearchParam(params, "material");
  const availability = getSearchParam(params, "availability");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.proveedor_materialWhereInput[] = [];

  if (supplier) {
    filters.push({
      id_proveedor: supplier,
    });
  }

  if (material) {
    filters.push({
      id_material: material,
    });
  }

  if (availability) {
    filters.push({
      disponibilidad: availability,
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.proveedor_materialWhereInput =
    filters.length > 0 ? { AND: filters } : {};

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
    prisma.proveedor.findMany({
      orderBy: {
        razon_social: "asc",
      },
      select: {
        id_proveedor: true,
        razon_social: true,
      },
    }),
    prisma.material.findMany({
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario - Proveedor-material
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Materiales por proveedor
          </h1>
          <p className="text-slate-600">
            Consulta que proveedores abastecen cada material o insumo.
          </p>
        </div>

        <Link
          href="/dashboard/inventory/supplier-materials/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva asociacion
        </Link>
      </section>

      <form
        action="/dashboard/inventory/supplier-materials"
        className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-5"
      >
        <select
          name="supplier"
          defaultValue={supplier}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los proveedores</option>
          {suppliers.map((item) => (
            <option key={item.id_proveedor} value={item.id_proveedor}>
              {item.razon_social}
            </option>
          ))}
        </select>

        <select
          name="material"
          defaultValue={material}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los materiales</option>
          {materials.map((item) => (
            <option key={item.id_material} value={item.id_material}>
              {item.nombre_material}
            </option>
          ))}
        </select>

        <select
          name="availability"
          defaultValue={availability}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Disponibilidad</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
          <option value="no_disponible">No disponible</option>
        </select>

        <select
          name="status"
          defaultValue={status}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Filtrar
          </button>
          <Link
            href="/dashboard/inventory/supplier-materials"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Limpiar
          </Link>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Codigo</th>
              <th className="px-4 py-3 font-semibold">Proveedor</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Unidad</th>
              <th className="px-4 py-3 font-semibold">Precio referencial</th>
              <th className="px-4 py-3 font-semibold">Entrega</th>
              <th className="px-4 py-3 font-semibold">Disponibilidad</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {relations.map((relation) => (
              <tr key={relation.id_proveedor_material} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  {relation.id_proveedor_material}
                </td>
                <td className="px-4 py-3 font-medium">
                  {relation.proveedor.razon_social}
                </td>
                <td className="px-4 py-3">
                  {relation.material.nombre_material}
                </td>
                <td className="px-4 py-3">{relation.unidad_medida}</td>
                <td className="px-4 py-3">
                  {formatMoney(relation.precio_referencial)}
                </td>
                <td className="px-4 py-3">
                  {relation.tiempo_entrega_dias
                    ? `${relation.tiempo_entrega_dias} dias`
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  {getAvailabilityLabel(relation.disponibilidad)}
                </td>
                <td className="px-4 py-3">
                  {relation.estado ? "Activo" : "Inactivo"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/dashboard/inventory/supplier-materials/${relation.id_proveedor_material}/edit`}
                      className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                    >
                      Editar
                    </Link>
                    <form action={toggleSupplierMaterialStatusAction}>
                      <input
                        type="hidden"
                        name="id_proveedor_material"
                        value={relation.id_proveedor_material}
                      />
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                      >
                        {relation.estado ? "Inactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {relations.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Todavia no hay asociaciones proveedor-material.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
