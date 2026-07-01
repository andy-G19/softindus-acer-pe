import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  setCurrentRecipeVersionAction,
  voidRecipeVersionAction,
} from "@/modules/production/recipe-versions/actions";

type RecipeVersionsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function getVersionStatusClass(status: string) {
  if (status === "vigente") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "reemplazada") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "anulada") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-600";
}

export default async function RecipeVersionsPage({
  params,
}: RecipeVersionsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

  const recipe = await prisma.receta_tecnica.findUnique({
    where: {
      id_receta: id,
    },
    include: {
      producto: true,
      usuario: true,
      version_receta: {
        include: {
          usuario: true,
          detalle_receta: {
            include: {
              material: true,
            },
            orderBy: {
              id_detalle_receta: "asc",
            },
          },
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
      },
    },
  });

  if (!recipe) {
    notFound();
  }

  const currentVersion = recipe.version_receta.find((version) => {
    return version.estado === "vigente";
  });

  const totalOrders = recipe.version_receta.reduce((total, version) => {
    return total + version._count.orden_trabajo;
  }, 0);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Produccion - Recetas tecnicas - Versiones
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Versiones de receta
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Receta: <span className="font-medium">{recipe.nombre_receta}</span>{" "}
            - Producto:{" "}
            <span className="font-medium">
              {recipe.producto.nombre_producto}
            </span>
          </p>

          {recipe.descripcion ? (
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              {recipe.descripcion}
            </p>
          ) : null}
        </div>

        {recipe.estado === "activa" ? (
          <Link
            href={`/dashboard/production/recipes/${recipe.id_receta}/versions/new`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Nueva version
          </Link>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Estado de receta</p>
          <p className="mt-2 text-2xl font-bold capitalize">{recipe.estado}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Version vigente</p>
          <p className="mt-2 text-2xl font-bold">
            {currentVersion?.numero_version ?? "Sin version"}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Historial</p>
          <p className="mt-2 text-2xl font-bold">
            {recipe.version_receta.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ordenes asociadas</p>
          <p className="mt-2 text-2xl font-bold">{totalOrders}</p>
        </div>
      </section>

      {!currentVersion ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta receta no tiene una version vigente. Crea una nueva version o
          marca como vigente una version valida del historial.
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Codigo</th>
              <th className="px-4 py-3 font-semibold">Version</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Motivo</th>
              <th className="px-4 py-3 font-semibold">Aprobado por</th>
              <th className="px-4 py-3 font-semibold">Materiales</th>
              <th className="px-4 py-3 font-semibold">Ordenes</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {recipe.version_receta.map((version) => (
              <tr key={version.id_version_receta} className="border-t align-top">
                <td className="px-4 py-3 font-mono text-xs">
                  {version.id_version_receta}
                </td>

                <td className="px-4 py-3 font-medium">
                  {version.numero_version}
                </td>

                <td className="px-4 py-3">
                  {formatDate(version.fecha_version)}
                </td>

                <td className="px-4 py-3">
                  {version.motivo_cambio ?? "-"}
                </td>

                <td className="px-4 py-3">
                  {version.usuario ? (
                    <>
                      {version.usuario.nombres} {version.usuario.apellidos}
                    </>
                  ) : (
                    "-"
                  )}
                </td>

                <td className="px-4 py-3">
                  <p className="font-medium">
                    {version._count.detalle_receta} material(es)
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {version.detalle_receta.slice(0, 3).map((detail) => (
                      <p key={detail.id_detalle_receta}>
                        {detail.material.nombre_material} -{" "}
                        {formatDecimal(detail.cantidad_requerida)}{" "}
                        {detail.unidad_medida}
                      </p>
                    ))}
                    {version.detalle_receta.length > 3 ? (
                      <p>
                        +{version.detalle_receta.length - 3} material(es) mas
                      </p>
                    ) : null}
                  </div>
                </td>

                <td className="px-4 py-3">{version._count.orden_trabajo}</td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getVersionStatusClass(
                      version.estado,
                    )}`}
                  >
                    {version.estado}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-2">
                    <Link
                      href={`/dashboard/production/recipes/${recipe.id_receta}/versions/${version.id_version_receta}/details`}
                      className="text-sm font-medium text-slate-600 hover:text-slate-950"
                    >
                      Ver materiales
                    </Link>

                    {version.estado !== "vigente" &&
                    version.estado !== "anulada" ? (
                      <form action={setCurrentRecipeVersionAction}>
                        <input
                          type="hidden"
                          name="id_receta"
                          value={recipe.id_receta}
                        />
                        <input
                          type="hidden"
                          name="id_version_receta"
                          value={version.id_version_receta}
                        />
                        <button
                          type="submit"
                          className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
                        >
                          Marcar vigente
                        </button>
                      </form>
                    ) : null}

                    {version.estado !== "anulada" &&
                    version._count.orden_trabajo === 0 ? (
                      <form action={voidRecipeVersionAction}>
                        <input
                          type="hidden"
                          name="id_receta"
                          value={recipe.id_receta}
                        />
                        <input
                          type="hidden"
                          name="id_version_receta"
                          value={version.id_version_receta}
                        />
                        <button
                          type="submit"
                          className="text-sm font-medium text-red-600 hover:text-red-800"
                        >
                          Anular
                        </button>
                      </form>
                    ) : null}

                    {version._count.orden_trabajo > 0 ? (
                      <span className="text-xs text-slate-500">
                        Usada en ordenes
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}

            {recipe.version_receta.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Todavia no hay versiones registradas para esta receta.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/production/recipes"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver a recetas tecnicas
        </Link>

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
