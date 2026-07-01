import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { toggleSupplierStatusAction } from "@/modules/inventory/suppliers/actions";

type SuppliersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function SuppliersPage({
  searchParams,
}: SuppliersPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const type = getSearchParam(params, "type");
  const payment = getSearchParam(params, "payment");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.proveedorWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_proveedor: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          razon_social: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          numero_documento: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          telefono: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (type) {
    filters.push({
      tipo_proveedor: type,
    });
  }

  if (payment) {
    filters.push({
      condicion_pago: payment,
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.proveedorWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [suppliers, supplierTypes, paymentConditions] = await Promise.all([
    prisma.proveedor.findMany({
      where,
      orderBy: {
        razon_social: "asc",
      },
    }),
    prisma.tipo_proveedor_catalogo.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        nombre: true,
        slug: true,
      },
    }),
    prisma.proveedor.findMany({
      where: {
        condicion_pago: {
          not: null,
        },
      },
      distinct: ["condicion_pago"],
      orderBy: {
        condicion_pago: "asc",
      },
      select: {
        condicion_pago: true,
      },
    }),
  ]);

  const typeLabels = new Map(
    supplierTypes.map((item) => [item.slug, item.nombre]),
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Proveedores
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-slate-600">
            Registra proveedores de materia prima, consumibles, repuestos y
            servicios.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/inventory/supplier-types"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Tipos de proveedor
          </Link>

          <Link
            href="/dashboard/inventory/suppliers/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Nuevo proveedor
          </Link>
        </div>
      </section>

      <form
        action="/dashboard/inventory/suppliers"
        className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto_auto]"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar proveedor..."
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />

        <select
          name="type"
          defaultValue={type}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los tipos</option>
          {supplierTypes.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.nombre}
            </option>
          ))}
        </select>

        <select
          name="payment"
          defaultValue={payment}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todas las condiciones</option>
          {paymentConditions.map((item) =>
            item.condicion_pago ? (
              <option key={item.condicion_pago} value={item.condicion_pago}>
                {item.condicion_pago}
              </option>
            ) : null,
          )}
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

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Filtrar
        </button>

        <Link
          href="/dashboard/inventory/suppliers"
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
              <th className="px-4 py-3 font-semibold">Razón social</th>
              <th className="px-4 py-3 font-semibold">Documento</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Teléfono</th>
              <th className="px-4 py-3 font-semibold">Condición de pago</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id_proveedor} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  {supplier.id_proveedor}
                </td>
                <td className="px-4 py-3 font-medium">
                  {supplier.razon_social}
                </td>
                <td className="px-4 py-3">
                  {supplier.numero_documento
                    ? `${supplier.tipo_documento ?? "-"} ${supplier.numero_documento}`
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  {typeLabels.get(supplier.tipo_proveedor) ??
                    supplier.tipo_proveedor}
                </td>
                <td className="px-4 py-3">{supplier.telefono ?? "-"}</td>
                <td className="px-4 py-3">
                  {supplier.condicion_pago ?? "-"}
                </td>
                <td className="px-4 py-3">
                  {supplier.estado ? "Activo" : "Inactivo"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/inventory/suppliers/${supplier.id_proveedor}/edit`}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium"
                    >
                      Editar
                    </Link>

                    <form action={toggleSupplierStatusAction}>
                      <input
                        type="hidden"
                        name="id_proveedor"
                        value={supplier.id_proveedor}
                      />
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1.5 text-xs font-medium"
                      >
                        {supplier.estado ? "Inactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay proveedores registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
