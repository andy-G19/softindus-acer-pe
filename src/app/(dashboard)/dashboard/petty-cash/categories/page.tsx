import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { createExpenseCategoryAction } from "@/modules/petty-cash/categories/actions";

export default async function ExpenseCategoriesPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const categories = await prisma.categoria_gasto.findMany({
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
            Dashboard · Caja chica y finanzas · Categorías
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Categorías de gasto
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra y consulta las categorías utilizadas para clasificar los
            egresos de caja chica del taller.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/petty-cash"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Badge variant="secondary">Fase 7.3</Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorías registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{categories.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total de categorías creadas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorías activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCategories.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Disponibles para registrar nuevos egresos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorías inactivas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{inactiveCategories.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No deberían usarse en nuevos movimientos.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Nueva categoría de gasto
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form action={createExpenseCategoryAction} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="nombre_categoria"
                  className="text-sm font-medium"
                >
                  Nombre de categoría
                </label>

                <input
                  id="nombre_categoria"
                  name="nombre_categoria"
                  type="text"
                  required
                  placeholder="Ejemplo: Repuestos"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="descripcion" className="text-sm font-medium">
                  Descripción
                </label>

                <textarea
                  id="descripcion"
                  name="descripcion"
                  rows={4}
                  placeholder="Describe para qué se usará esta categoría."
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="estado" className="text-sm font-medium">
                  Estado
                </label>

                <select
                  id="estado"
                  name="estado"
                  defaultValue="true"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Guardar categoría
              </button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Listado de categorías
            </CardTitle>
          </CardHeader>

          <CardContent>
            {categories.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  Aún no hay categorías registradas.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Puedes iniciar con Repuestos, Consumibles, Refrigerios,
                  Transporte, Mantenimiento y Otros.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3">Código</th>
                      <th className="py-2 pr-3">Categoría</th>
                      <th className="py-2 pr-3">Descripción</th>
                      <th className="py-2 text-right">Estado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {categories.map((category) => (
                      <tr
                        key={category.id_categoria_gasto}
                        className="border-b"
                      >
                        <td className="py-2 pr-3 font-mono text-xs">
                          {category.id_categoria_gasto}
                        </td>

                        <td className="py-2 pr-3 font-medium">
                          {category.nombre_categoria}
                        </td>

                        <td className="py-2 pr-3 text-muted-foreground">
                          {category.descripcion ?? "-"}
                        </td>

                        <td className="py-2 text-right">
                          <Badge
                            variant={category.estado ? "default" : "secondary"}
                          >
                            {category.estado ? "Activa" : "Inactiva"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}