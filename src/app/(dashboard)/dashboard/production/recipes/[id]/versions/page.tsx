import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import {
  setCurrentRecipeVersionAction,
  voidRecipeVersionAction,
} from "@/modules/production/recipe-versions/actions";

type RecipeVersionsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

function getVersionBadgeVariant(status: string) {
  if (status === "vigente") {
    return "success" as const;
  }

  if (status === "reemplazada") {
    return "warning" as const;
  }

  if (status === "anulada") {
    return "destructive" as const;
  }

  return "outline" as const;
}

export default async function RecipeVersionsPage({
  params,
}: RecipeVersionsPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

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
      <PageHeader
        title="Versiones de receta"
        description={`Receta: ${recipe.nombre_receta} · Producto: ${recipe.producto.nombre_producto}${recipe.descripcion ? ` · ${recipe.descripcion}` : ""}`}
        backHref={navigationHrefs.recipes}
        backLabel="Volver a recetas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas", href: navigationHrefs.recipes },
          { label: "Versiones" },
        ])}
        actions={
          recipe.estado === "activa" ? (
            <Button asChild>
              <Link
                href={`/dashboard/production/recipes/${recipe.id_receta}/versions/new`}
              >
                Nueva versión
              </Link>
            </Button>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Estado de receta" value={recipe.estado} description="Estado maestro de la receta." tone={recipe.estado === "activa" ? "success" : "warning"} />
        <KpiCard title="Versión vigente" value={currentVersion?.numero_version ?? "Sin versión"} description="Versión usada actualmente." tone="info" />
        <KpiCard title="Historial" value={recipe.version_receta.length.toString()} description="Versiones registradas." tone="info" />
        <KpiCard title="Órdenes asociadas" value={totalOrders.toString()} description="Usando alguna versión." tone="info" />
      </section>

      {!currentVersion ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta receta no tiene una versión vigente. Crea una nueva versión o
            marca como vigente una versión válida del historial.
          </AlertDescription>
        </Alert>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Versión</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Aprobado por</TableHead>
            <TableHead>Materiales</TableHead>
            <TableHead>Órdenes</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {recipe.version_receta.map((version) => (
            <TableRow key={version.id_version_receta} className="align-top">
              <TableCell className="text-xs">
                {version.id_version_receta}
              </TableCell>

              <TableCell className="font-medium">
                {version.numero_version}
              </TableCell>

              <TableCell>{formatDate(version.fecha_version)}</TableCell>

              <TableCell>{version.motivo_cambio ?? "-"}</TableCell>

              <TableCell>
                {version.usuario ? (
                  <>
                    {version.usuario.nombres} {version.usuario.apellidos}
                  </>
                ) : (
                  "-"
                )}
              </TableCell>

              <TableCell>
                <p className="font-medium">
                  {version._count.detalle_receta} material(es)
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {version.detalle_receta.slice(0, 3).map((detail) => (
                    <p key={detail.id_detalle_receta}>
                      {detail.material.nombre_material} -{" "}
                      {formatDecimal(detail.cantidad_requerida)}{" "}
                      {detail.unidad_medida}
                    </p>
                  ))}
                  {version.detalle_receta.length > 3 ? (
                    <p>
                      +{version.detalle_receta.length - 3} material(es) más
                    </p>
                  ) : null}
                </div>
              </TableCell>

              <TableCell>{version._count.orden_trabajo}</TableCell>

              <TableCell>
                <Badge variant={getVersionBadgeVariant(version.estado)}>
                  {version.estado}
                </Badge>
              </TableCell>

              <TableCell>
                <div className="flex flex-col items-start gap-2">
                  <Button variant="link" className="h-auto p-0" asChild>
                    <Link
                      href={`/dashboard/production/recipes/${recipe.id_receta}/versions/${version.id_version_receta}/details`}
                    >
                      Ver materiales
                    </Link>
                  </Button>

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
                      <Button
                        type="submit"
                        variant="link"
                        className="h-auto p-0 text-chart-3 hover:text-chart-3"
                      >
                        Marcar vigente
                      </Button>
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
                      <ConfirmDeleteButton
                        title="¿Anular versión de receta?"
                        description="Esta acción anulará la versión de la receta y no se puede deshacer."
                        confirmText="Confirmar anulación"
                        entityName="versión de receta"
                        className="rounded-none border-0 bg-transparent px-0 py-0 hover:bg-transparent"
                      >
                        Anular
                      </ConfirmDeleteButton>
                    </form>
                  ) : null}

                  {version._count.orden_trabajo > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Usada en órdenes
                    </span>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}

          {recipe.version_receta.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay versiones registradas para esta receta."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
