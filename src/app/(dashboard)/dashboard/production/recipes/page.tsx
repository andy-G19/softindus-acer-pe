import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { toggleTechnicalRecipeStatusAction } from "@/modules/production/recipes/actions";

type RecipesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(value);
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

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const product = getSearchParam(params, "product");
  const status = getSearchParam(params, "status");
  const filters: Prisma.receta_tecnicaWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_receta: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_receta: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          producto: {
            nombre_producto: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  if (product) {
    filters.push({
      id_producto: product,
    });
  }

  if (status) {
    filters.push({
      estado: status,
    });
  }

  const where: Prisma.receta_tecnicaWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [recipes, products] = await Promise.all([
    prisma.receta_tecnica.findMany({
      where,
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
    }),
    prisma.producto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_producto: "asc",
      },
      select: {
        id_producto: true,
        nombre_producto: true,
      },
    }),
  ]);

  const activeRecipes = recipes.filter((recipe) => recipe.estado === "activa");
  const recipesWithCurrentVersion = recipes.filter((recipe) => {
    return recipe.version_receta.length > 0;
  });
  const recipesWithoutCurrentVersion =
    recipes.length - recipesWithCurrentVersion.length;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Recetas técnicas"
        description="Administra recetas por producto, versión vigente e historial de materiales requeridos para producción."
        backHref={navigationHrefs.production}
        backLabel="Volver a producción"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Recetas" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/production/recipes/new">Nueva receta</Link>
          </Button>
        }
      />

      <form className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[1.5fr_1fr_1fr_auto_auto]">
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Buscar receta, código o producto..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product">Producto</Label>
          <NativeSelect id="product" name="product" defaultValue={product}>
            <option value="">Todos los productos</option>
            {products.map((item) => (
              <option key={item.id_producto} value={item.id_producto}>
                {item.nombre_producto}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <NativeSelect id="status" name="status" defaultValue={status}>
            <option value="">Todos los estados</option>
            <option value="activa">Activa</option>
            <option value="inactiva">Inactiva</option>
          </NativeSelect>
        </div>

        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Filtrar
          </Button>
        </div>

        <div className="flex items-end">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard/production/recipes">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Recetas registradas" value={recipes.length.toString()} description="Total en el sistema." tone="info" />
        <KpiCard title="Recetas activas" value={activeRecipes.length.toString()} description="Disponibles para uso." tone="success" />
        <KpiCard title="Con versión vigente" value={recipesWithCurrentVersion.length.toString()} description="Listas para producir." tone="success" />
        <KpiCard title="Sin versión vigente" value={recipesWithoutCurrentVersion.toString()} description="Requieren atención." tone="warning" />
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Receta</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Versión vigente</TableHead>
            <TableHead>Historial</TableHead>
            <TableHead>Materiales</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {recipes.map((recipe) => {
            const currentVersion = recipe.version_receta[0];

            return (
              <TableRow key={recipe.id_receta}>
                <TableCell className="text-xs">{recipe.id_receta}</TableCell>

                <TableCell>
                  <div className="font-medium">{recipe.nombre_receta}</div>
                  {recipe.descripcion ? (
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                      {recipe.descripcion}
                    </p>
                  ) : null}
                </TableCell>

                <TableCell>
                  <div className="font-medium">
                    {recipe.producto.nombre_producto}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {recipe.producto.categoria}
                  </p>
                </TableCell>

                <TableCell>{formatDate(recipe.fecha_creacion)}</TableCell>

                <TableCell>
                  {currentVersion ? (
                    <div>
                      <p className="font-medium">
                        {currentVersion.numero_version}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {currentVersion.id_version_receta}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Sin versión</span>
                  )}
                </TableCell>

                <TableCell>
                  {recipe._count.version_receta} versión(es)
                </TableCell>

                <TableCell>
                  {currentVersion?._count.detalle_receta ?? 0}
                </TableCell>

                <TableCell>
                  <Badge variant={recipe.estado === "activa" ? "success" : "outline"}>
                    {recipe.estado}
                  </Badge>
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link
                        href={`/dashboard/production/recipes/${recipe.id_receta}/versions`}
                      >
                        Ver historial
                      </Link>
                    </Button>

                    <form action={toggleTechnicalRecipeStatusAction}>
                      <input
                        type="hidden"
                        name="id_receta"
                        value={recipe.id_receta}
                      />
                      <input type="hidden" name="estado" value={recipe.estado} />
                      <Button type="submit" variant="link" className="h-auto p-0">
                        {recipe.estado === "activa" ? "Inactivar" : "Activar"}
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {recipes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay recetas técnicas registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
