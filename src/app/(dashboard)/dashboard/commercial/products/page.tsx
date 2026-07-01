import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { toggleProductStatusAction } from "@/modules/commercial/products/actions";

type ProductsPageProps = {
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

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const category = getSearchParam(params, "category");
  const unit = getSearchParam(params, "unit");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.productoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_producto: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_producto: {
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

  const where: Prisma.productoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [products, categories, units] = await Promise.all([
    prisma.producto.findMany({
      where,
      orderBy: {
        fecha_registro: "desc",
      },
    }),
    prisma.categoria_producto.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        nombre: true,
        slug: true,
      },
    }),
    prisma.producto.findMany({
      distinct: ["unidad_medida"],
      orderBy: {
        unidad_medida: "asc",
      },
      select: {
        unidad_medida: true,
      },
    }),
  ]);

  const canManageProduct = session.user.role === "ADMIN";
  const categoryLabels = new Map(
    categories.map((item) => [item.slug, item.nombre]),
  );

  return (
    <main className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Lista de productos registrados para ventas, pedidos y producción.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/commercial/product-categories"
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Categorías
          </Link>

          {canManageProduct ? (
            <Link
              href="/dashboard/commercial/products/new"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Nuevo producto
            </Link>
          ) : null}
        </div>
      </div>

      <form
        action="/dashboard/commercial/products"
        className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto_auto]"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar producto..."
          className="rounded-md border px-3 py-2 text-sm"
        />

        <select
          name="category"
          defaultValue={category}
          className="rounded-md border px-3 py-2 text-sm"
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
          className="rounded-md border px-3 py-2 text-sm"
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
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>

        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Filtrar
        </button>

        <Link
          href="/dashboard/commercial/products"
          className="rounded-md border px-4 py-2 text-center text-sm font-medium"
        >
          Limpiar filtros
        </Link>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-left">Unidad</th>
              <th className="px-4 py-3 text-left">Precio referencial</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {products.map((product) => (
              <tr key={product.id_producto} className="border-t">
                <td className="px-4 py-3">{product.id_producto}</td>
                <td className="px-4 py-3 font-medium">
                  {product.nombre_producto}
                </td>
                <td className="px-4 py-3">
                  {categoryLabels.get(product.categoria) ?? product.categoria}
                </td>
                <td className="px-4 py-3">{product.unidad_medida}</td>
                <td className="px-4 py-3">
                  {formatMoney(product.precio_referencial)}
                </td>
                <td className="px-4 py-3">
                  {product.estado ? "Activo" : "Inactivo"}
                </td>
                <td className="px-4 py-3">
                  {canManageProduct ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/commercial/products/${product.id_producto}/edit`}
                        className="rounded-md border px-3 py-1.5 text-xs font-medium"
                      >
                        Editar
                      </Link>

                      <form action={toggleProductStatusAction}>
                        <input
                          type="hidden"
                          name="id_producto"
                          value={product.id_producto}
                        />
                        <button
                          type="submit"
                          className="rounded-md border px-3 py-1.5 text-xs font-medium"
                        >
                          {product.estado ? "Inactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Solo lectura
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {products.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavía no hay productos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
