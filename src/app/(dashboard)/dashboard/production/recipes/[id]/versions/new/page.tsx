import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createRecipeVersionAction } from "@/modules/production/recipe-versions/actions";

type NewRecipeVersionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

export default async function NewRecipeVersionPage({
  params,
}: NewRecipeVersionPageProps) {
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
      version_receta: true,
    },
  });

  if (!recipe) {
    notFound();
  }

  const hasVersion = Boolean(recipe.version_receta);
  const canCreateVersion = recipe.estado === "activa" && !hasVersion;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Producción · Recetas técnicas · Versiones
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Nueva versión de receta
        </h1>

        <p className="mt-2 text-slate-600">
          Receta: <span className="font-medium">{recipe.nombre_receta}</span> ·
          Producto:{" "}
          <span className="font-medium">{recipe.producto.nombre_producto}</span>
        </p>
      </section>

      {recipe.estado !== "activa" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta receta no está activa. Actívala antes de crear una versión.
        </section>
      ) : null}

      {hasVersion ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta receta ya tiene una versión registrada. En esta fase trabajaremos
          con una versión vigente inicial. Más adelante podemos ampliar el
          histórico completo de versiones.
        </section>
      ) : null}

      <form
        action={createRecipeVersionAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="id_receta" value={recipe.id_receta} />

        <div className="space-y-2">
          <label className="text-sm font-medium">Número de versión *</label>

          <input
            name="numero_version"
            required
            maxLength={20}
            defaultValue="V1"
            placeholder="Ej. V1"
            disabled={!canCreateVersion}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />

          <p className="text-xs text-slate-500">
            Usa códigos simples como V1, V1.0 o 2026-01.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Motivo o descripción</label>

          <textarea
            name="motivo_cambio"
            rows={5}
            maxLength={700}
            defaultValue="Versión inicial de la receta técnica."
            placeholder="Ej. Versión inicial aprobada para producción."
            disabled={!canCreateVersion}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>

        <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Importante</p>

          <p className="mt-1">
            Esta versión será marcada como vigente. En la siguiente fase
            agregaremos los materiales y cantidades requeridas para fabricar una
            unidad del producto.
          </p>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href={`/dashboard/production/recipes/${recipe.id_receta}/versions`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={!canCreateVersion}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Guardar versión
          </button>
        </div>
      </form>
    </main>
  );
}