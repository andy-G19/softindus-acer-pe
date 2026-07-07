import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
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
      <PageHeader
        title="Nueva versión de receta"
        description={`Receta: ${recipe.nombre_receta} · Producto: ${recipe.producto.nombre_producto}`}
        backHref={backHref}
        backLabel="Volver a versiones"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas", href: navigationHrefs.recipes },
          { label: "Nueva versión" },
        ])}
      />

      {recipe.estado !== "activa" ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta receta no está activa. Actívala antes de crear una nueva
            versión.
          </AlertDescription>
        </Alert>
      ) : null}

      {materials.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay materiales activos para registrar el detalle de la
            versión.
          </AlertDescription>
        </Alert>
      ) : null}

      {latestVersion ? (
        <Alert variant="info">
          <AlertDescription>
            Se cargaron como base los materiales de la versión{" "}
            <span className="font-medium text-foreground">
              {latestVersion.numero_version}
            </span>
            . Puedes ajustarlos antes de guardar la nueva versión vigente.
          </AlertDescription>
        </Alert>
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
