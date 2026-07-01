import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { toggleTechnicalRecipeStatusAction } from "@/modules/production/recipes/actions";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(value);
}

function getRecipeStatusClass(status: string) {
  if (status === "activa") {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-slate-100 text-slate-600";
}

export default async function RecipesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const recipes = await prisma.receta_tecnica.findMany({
    include: {
      producto: true,
      usuario: true,
      version_receta: {
        where: {
          estado: "vigente",
        },
        include: {
          _count: {
            select: {
              detalle_receta: true,
              orden_trabajo: true,
            },
          },
        },
        orderBy: {
          fecha_version: "desc",
        },
        take: 1,
      },
      _count: {
        select: {
          version_receta: true,
        },
      },
    },
    orderBy: {
      fecha_creacion: "desc",
    },
  });

  const activeRecipes = recipes.filter((recipe) => recipe.estado === "activa");
  const recipesWithCurrentVersion = recipes.filter((recipe) => {
    return recipe.version_receta.length > 0;
  });
  const recipesWithoutCurrentVersion =
    recipes.length - recipesWithCurrentVersion.length;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Produccion - Recetas tecnicas
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Recetas tecnicas
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Administra recetas por producto, version vigente e historial de
            materiales requeridos para produccion.
          </p>
        </div>

        <Link
          href="/dashboard/production/recipes/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva receta
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Recetas registradas</p>
          <p className="mt-2 text-3xl font-bold">{recipes.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Recetas activas</p>
          <p className="mt-2 text-3xl font-bold">{activeRecipes.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Con version vigente</p>
          <p className="mt-2 text-3xl font-bold">
            {recipesWithCurrentVersion.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Sin version vigente</p>
          <p className="mt-2 text-3xl font-bold">
            {recipesWithoutCurrentVersion}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Codigo</th>
              <th className="px-4 py-3 font-semibold">Receta</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Version vigente</th>
              <th className="px-4 py-3 font-semibold">Historial</th>
              <th className="px-4 py-3 font-semibold">Materiales</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {recipes.map((recipe) => {
              const currentVersion = recipe.version_receta[0];

              return (
                <tr key={recipe.id_receta} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {recipe.id_receta}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium">{recipe.nombre_receta}</div>
                    {recipe.descripcion ? (
                      <p className="mt-1 max-w-md text-xs text-slate-500">
                        {recipe.descripcion}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {recipe.producto.nombre_producto}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {recipe.producto.categoria}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    {formatDate(recipe.fecha_creacion)}
                  </td>

                  <td className="px-4 py-3">
                    {currentVersion ? (
                      <div>
                        <p className="font-medium">
                          {currentVersion.numero_version}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {currentVersion.id_version_receta}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-500">Sin version</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {recipe._count.version_receta} version(es)
                  </td>

                  <td className="px-4 py-3">
                    {currentVersion?._count.detalle_receta ?? 0}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getRecipeStatusClass(
                        recipe.estado,
                      )}`}
                    >
                      {recipe.estado}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/dashboard/production/recipes/${recipe.id_receta}/versions`}
                        className="text-sm font-medium text-slate-600 hover:text-slate-950"
                      >
                        Ver historial
                      </Link>

                      <form action={toggleTechnicalRecipeStatusAction}>
                        <input
                          type="hidden"
                          name="id_receta"
                          value={recipe.id_receta}
                        />
                        <input
                          type="hidden"
                          name="estado"
                          value={recipe.estado}
                        />
                        <button
                          type="submit"
                          className="text-sm font-medium text-slate-600 hover:text-slate-950"
                        >
                          {recipe.estado === "activa"
                            ? "Desactivar"
                            : "Activar"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}

            {recipes.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Todavia no hay recetas tecnicas registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/production"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver a produccion
        </Link>
      </div>
    </main>
  );
}
