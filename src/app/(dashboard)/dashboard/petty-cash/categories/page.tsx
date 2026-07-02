import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import {
  createExpenseCategoryAction,
  toggleExpenseCategoryStatusAction,
} from "@/modules/petty-cash/categories/actions";
import { ExpenseCategoryForm } from "@/modules/petty-cash/categories/expense-category-form";

type ExpenseCategoriesPageProps = {
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

export default async function ExpenseCategoriesPage({
  searchParams,
}: ExpenseCategoriesPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.categoria_gastoWhereInput[] = [];

  if (q) {
    filters.push({
      nombre_categoria: {
        contains: q,
        mode: "insensitive",
      },
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.categoria_gastoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const categories = await prisma.categoria_gasto.findMany({
    where,
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre_categoria: "asc",
      },
    ],
  });

  const activeCategories = categories.filter((category) => category.estado);
  const inactiveCategories = categories.filter((category) => !category.estado);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Caja chica y finanzas - Categorias
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Categorias de gasto
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Registra y consulta categorias utilizadas para clasificar egresos de
            caja chica del taller.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/petty-cash"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al modulo
          </Link>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorias registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{categories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCategories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inactivas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{inactiveCategories.length}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Nueva categoria de gasto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseCategoryForm
              action={createExpenseCategoryAction}
              defaultValues={{ estado: "true" }}
              submitLabel="Guardar categoria"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Listado de categorias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action="/dashboard/petty-cash/categories"
              className="grid gap-3 md:grid-cols-3"
            >
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar categoria..."
                className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
              <select
                name="status"
                defaultValue={status}
                className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activa</option>
                <option value="inactive">Inactiva</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Filtrar
                </button>
                <Link
                  href="/dashboard/petty-cash/categories"
                  className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
                >
                  Limpiar
                </Link>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Codigo</th>
                    <th className="py-2 pr-3">Categoria</th>
                    <th className="py-2 pr-3">Descripcion</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id_categoria_gasto} className="border-b">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {category.id_categoria_gasto}
                      </td>
                      <td className="py-2 pr-3 font-medium">
                        {category.nombre_categoria}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {category.descripcion ?? "-"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Badge
                          variant={category.estado ? "default" : "secondary"}
                        >
                          {category.estado ? "Activa" : "Inactiva"}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/petty-cash/categories/${category.id_categoria_gasto}/edit`}
                            className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                          >
                            Editar
                          </Link>
                          <form action={toggleExpenseCategoryStatusAction}>
                            <input
                              type="hidden"
                              name="id_categoria_gasto"
                              value={category.id_categoria_gasto}
                            />
                            <button
                              type="submit"
                              className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                            >
                              {category.estado ? "Inactivar" : "Activar"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Aun no hay categorias registradas.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
