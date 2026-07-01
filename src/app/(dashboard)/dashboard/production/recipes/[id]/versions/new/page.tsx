import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { RecipeVersionForm } from "@/modules/production/recipes/components/recipe-version-form";

type NewRecipeVersionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
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

  const [recipe, materials] = await Promise.all([
    prisma.receta_tecnica.findUnique({
      where: {
        id_receta: id,
      },
      include: {
        producto: true,
        version_receta: {
          include: {
            detalle_receta: {
              include: {
                material: true,
              },
              orderBy: {
                id_detalle_receta: "asc",
              },
            },
          },
          orderBy: {
            fecha_version: "desc",
          },
          take: 1,
        },
      },
    }),
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
        unidad_medida: true,
        costo_unitario_actual: true,
      },
    }),
  ]);

  if (!recipe) {
    notFound();
  }

  const latestVersion = recipe.version_receta[0];
  const canCreateVersion = recipe.estado === "activa" && materials.length > 0;
  const backHref = `/dashboard/production/recipes/${recipe.id_receta}/versions`;
  const materialOptions = materials.map((material) => ({
    ...material,
    costo_unitario_actual: material.costo_unitario_actual.toString(),
  }));
  const initialDetails = latestVersion?.detalle_receta.map((detail) => ({
    key: detail.id_detalle_receta,
    id_material: detail.id_material,
    cantidad_requerida: detail.cantidad_requerida.toString(),
    tipo_consumo: detail.tipo_consumo,
    merma_estimada_porcentaje:
      detail.merma_estimada_porcentaje?.toString() ?? "0",
    observaciones: detail.observaciones ?? "",
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Produccion - Recetas tecnicas - Versiones
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Nueva version de receta
        </h1>

        <p className="mt-2 text-slate-600">
          Receta: <span className="font-medium">{recipe.nombre_receta}</span> -
          Producto:{" "}
          <span className="font-medium">{recipe.producto.nombre_producto}</span>
        </p>
      </section>

      {recipe.estado !== "activa" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta receta no esta activa. Activala antes de crear una nueva version.
        </section>
      ) : null}

      {materials.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          No hay materiales activos para registrar el detalle de la version.
        </section>
      ) : null}

      {latestVersion ? (
        <section className="rounded-xl border bg-slate-50 p-5 text-sm text-slate-600">
          Se cargaron como base los materiales de la version{" "}
          <span className="font-medium">{latestVersion.numero_version}</span>.
          Puedes ajustarlos antes de guardar la nueva version vigente.
        </section>
      ) : null}

      <RecipeVersionForm
        idReceta={recipe.id_receta}
        backHref={backHref}
        materials={materialOptions}
        initialDetails={initialDetails}
        canCreateVersion={canCreateVersion}
      />
    </main>
  );
}
