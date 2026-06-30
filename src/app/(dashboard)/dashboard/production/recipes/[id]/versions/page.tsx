import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

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

function getVersionStatusClass(status: string) {
  if (status === "vigente") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "histórica") {
    return "bg-amber-50 text-amber-700";
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
          _count: {
            select: {
              detalle_receta: true,
              orden_trabajo: true,
            },
          },
        },
      },
    },
  });

  if (!recipe) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Producción · Recetas técnicas · Versiones
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Versiones de receta
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Receta: <span className="font-medium">{recipe.nombre_receta}</span>{" "}
            · Producto:{" "}
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

        {!recipe.version_receta ? (
          <Link
            href={`/dashboard/production/recipes/${recipe.id_receta}/versions/new`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Nueva versión
          </Link>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Estado de receta</p>
          <p className="mt-2 text-2xl font-bold capitalize">{recipe.estado}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Versión vigente</p>
          <p className="mt-2 text-2xl font-bold">
            {recipe.version_receta?.numero_version ?? "Sin versión"}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Materiales registrados</p>
          <p className="mt-2 text-2xl font-bold">
            {recipe.version_receta?._count.detalle_receta ?? 0}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Órdenes asociadas</p>
          <p className="mt-2 text-2xl font-bold">
            {recipe.version_receta?._count.orden_trabajo ?? 0}
          </p>
        </div>
      </section>

      {!recipe.version_receta ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta receta todavía no tiene versión registrada. Crea una versión
          inicial para poder agregar materiales en la siguiente fase.
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Versión</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Motivo</th>
              <th className="px-4 py-3 font-semibold">Aprobado por</th>
              <th className="px-4 py-3 font-semibold">Materiales</th>
              <th className="px-4 py-3 font-semibold">Órdenes</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acción</th>
            </tr>
          </thead>

          <tbody>
            {recipe.version_receta ? (
              <tr className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  {recipe.version_receta.id_version_receta}
                </td>

                <td className="px-4 py-3 font-medium">
                  {recipe.version_receta.numero_version}
                </td>

                <td className="px-4 py-3">
                  {formatDate(recipe.version_receta.fecha_version)}
                </td>

                <td className="px-4 py-3">
                  {recipe.version_receta.motivo_cambio ?? "-"}
                </td>

                <td className="px-4 py-3">
                  {recipe.version_receta.usuario ? (
                    <>
                      {recipe.version_receta.usuario.nombres}{" "}
                      {recipe.version_receta.usuario.apellidos}
                    </>
                  ) : (
                    "-"
                  )}
                </td>

                <td className="px-4 py-3">
                  {recipe.version_receta._count.detalle_receta}
                </td>

                <td className="px-4 py-3">
                  {recipe.version_receta._count.orden_trabajo}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getVersionStatusClass(
                      recipe.version_receta.estado,
                    )}`}
                  >
                    {recipe.version_receta.estado}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/production/recipes/${recipe.id_receta}/versions/${recipe.version_receta.id_version_receta}/details`}
                    className="text-sm font-medium text-slate-600 hover:text-slate-950"
                  >
                    Ver materiales
                  </Link>
                </td>

              </tr>
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay versiones registradas para esta receta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/production/recipes"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Volver a recetas técnicas
        </Link>

        <Link
          href="/dashboard/production"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver al módulo producción
        </Link>
      </div>
    </main>
  );
}