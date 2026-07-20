import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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
import { toggleFabricationRouteStatusAction } from "@/modules/production/routes/actions";

type FabricationRoutesPageProps = {
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

export default async function FabricationRoutesPage({
  searchParams,
}: FabricationRoutesPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const product = getSearchParam(params, "product");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.ruta_fabricacionWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_ruta: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_ruta: {
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

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.ruta_fabricacionWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [routes, products] = await Promise.all([
    prisma.ruta_fabricacion.findMany({
      where,
      include: {
        producto: true,
        _count: {
          select: {
            etapa_ruta: true,
            orden_trabajo: true,
          },
        },
      },
      orderBy: [
        {
          estado: "desc",
        },
        {
          nombre_ruta: "asc",
        },
      ],
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

  return (
    <main className="space-y-6">
      <PageHeader
        title="Rutas de fabricación"
        description="Consulta las rutas productivas definidas para cada producto del taller."
        backHref={navigationHrefs.production}
        backLabel="Volver a producción"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/production/routes/new">Nueva ruta</Link>
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
            placeholder="Buscar ruta, código o producto..."
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
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </NativeSelect>
        </div>

        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Filtrar
          </Button>
        </div>

        <div className="flex items-end">
          <Button variant="clear" className="w-full" asChild>
            <Link href="/dashboard/production/routes">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Ruta</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Etapas</TableHead>
            <TableHead>Órdenes asociadas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {routes.map((route) => (
            <TableRow key={route.id_ruta}>
              <TableCell className="text-xs">{route.id_ruta}</TableCell>

              <TableCell>
                <div className="font-medium">{route.nombre_ruta}</div>

                {route.descripcion ? (
                  <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                    {route.descripcion}
                  </p>
                ) : null}
              </TableCell>

              <TableCell>{route.producto.nombre_producto}</TableCell>

              <TableCell className="capitalize">
                {route.producto.categoria}
              </TableCell>

              <TableCell>{route._count.etapa_ruta}</TableCell>

              <TableCell>{route._count.orden_trabajo}</TableCell>

              <TableCell>
                <Badge variant={route.estado ? "success" : "outline"}>
                  {route.estado ? "Activa" : "Inactiva"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <Button variant="link" className="h-auto justify-start p-0" asChild>
                    <Link href={`/dashboard/production/routes/${route.id_ruta}/edit`}>
                      Editar
                    </Link>
                  </Button>

                  <Button variant="link" className="h-auto justify-start p-0" asChild>
                    <Link
                      href={`/dashboard/production/routes/${route.id_ruta}/stages`}
                    >
                      Gestionar etapas
                    </Link>
                  </Button>

                  <form action={toggleFabricationRouteStatusAction}>
                    <input type="hidden" name="id_ruta" value={route.id_ruta} />

                    <Button
                      type="submit"
                      variant="link"
                      className="h-auto justify-start p-0"
                    >
                      {route.estado ? "Inactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}

          {routes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay rutas de fabricación registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
