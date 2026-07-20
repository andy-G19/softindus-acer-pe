import {
  CheckCircle2,
  ClipboardList,
  Recycle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateReusableScrapStatusAction } from "@/modules/waste-scrap/reusable-scraps/status-actions";

type SearchParams = {
  estado?: string;
  material?: string;
  q?: string;
};

type ReusableScrapsPageProps = {
  searchParams?: Promise<SearchParams>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function getStatusBadgeVariant(status: string) {
  if (status === "disponible") {
    return "success" as const;
  }

  if (status === "reutilizado") {
    return "info" as const;
  }

  if (status === "descartado") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export default async function ReusableScrapsPage({
  searchParams,
}: ReusableScrapsPageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const params = searchParams ? await searchParams : {};

  const estado = params.estado?.trim() ?? "";
  const material = params.material?.trim() ?? "";
  const query = params.q?.trim() ?? "";

  const where = {
    ...(estado
      ? {
          estado,
        }
      : {}),

    ...(material
      ? {
          id_material: material,
        }
      : {}),

    ...(query
      ? {
          OR: [
            {
              id_retazo: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              tipo_material: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              medida_aproximada: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              ubicacion: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              id_orden_trabajo: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [
    materials,
    retazos,
    totalFiltered,
    totalRetazos,
    retazosDisponibles,
    retazosReutilizados,
    retazosDescartados,
  ] = await Promise.all([
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
      },
    }),

    prisma.retazo_reutilizable.findMany({
      where,
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        material: true,
        orden_trabajo: {
          include: {
            producto: true,
            cliente: true,
          },
        },
        usuario: true,
      },
    }),

    prisma.retazo_reutilizable.count({
      where,
    }),

    prisma.retazo_reutilizable.count(),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "disponible",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "reutilizado",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "descartado",
      },
    }),
  ]);

  const hasFilters = Boolean(estado || material || query);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Retazos reutilizables"
        description="Consulta los retazos aprovechables registrados durante producción. Puedes filtrar por estado, material de origen o buscar por código, medida, ubicación u orden de trabajo. Desde este listado también puedes marcar retazos disponibles como reutilizados o descartados."
        backHref={navigationHrefs.wasteScrap}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mermas y chatarra", href: navigationHrefs.wasteScrap },
          { label: "Retazos reutilizables" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/waste-scrap/reusable-scraps/new">
              Registrar retazo
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total registrados" value={totalRetazos.toString()} description={`${totalFiltered} según filtros`} tone="info" icon={ClipboardList} />
        <KpiCard title="Disponibles" value={retazosDisponibles.toString()} description="Listos para reutilizar" tone="success" icon={CheckCircle2} />
        <KpiCard title="Reutilizados" value={retazosReutilizados.toString()} description="Aprovechados en producción" tone="info" icon={Recycle} />
        <KpiCard title="Descartados" value={retazosDescartados.toString()} description="No aprovechables" tone="warning" icon={XCircle} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <NativeSelect id="estado" name="estado" defaultValue={estado}>
                <option value="">Todos</option>
                <option value="disponible">Disponible</option>
                <option value="reutilizado">Reutilizado</option>
                <option value="descartado">Descartado</option>
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="material">Material</Label>
              <NativeSelect id="material" name="material" defaultValue={material}>
                <option value="">Todos</option>
                {materials.map((item) => (
                  <option key={item.id_material} value={item.id_material}>
                    {item.nombre_material} · {item.categoria}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Código, medida, ubicación u orden"
              />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit">Filtrar</Button>
              {hasFilters ? (
                <Button variant="outline" asChild>
                  <Link href="/dashboard/waste-scrap/reusable-scraps">
                    Limpiar
                  </Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado de retazos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {retazos.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron retazos con los filtros seleccionados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Medida</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {retazos.map((item) => (
                  <TableRow key={item.id_retazo} className="align-top">
                    <TableCell className="font-mono text-xs">
                      {item.id_retazo}
                    </TableCell>

                    <TableCell>
                      <p className="font-medium">
                        {item.material.nombre_material}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.tipo_material}
                      </p>
                    </TableCell>

                    <TableCell>
                      {formatNumber(item.cantidad)} {item.unidad_medida}
                    </TableCell>

                    <TableCell>{item.medida_aproximada ?? "-"}</TableCell>

                    <TableCell>{item.ubicacion ?? "-"}</TableCell>

                    <TableCell>
                      {item.orden_trabajo ? (
                        <div>
                          <p className="font-mono text-xs">
                            {item.orden_trabajo.id_orden_trabajo}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.orden_trabajo.producto.nombre_producto}
                          </p>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(item.estado)}>
                        {item.estado}
                      </Badge>
                    </TableCell>

                    <TableCell>{formatDate(item.fecha_registro)}</TableCell>

                    <TableCell>
                      {item.estado === "disponible" ? (
                        <div className="flex flex-col gap-2">
                          <form action={updateReusableScrapStatusAction}>
                            <input type="hidden" name="id_retazo" value={item.id_retazo} />
                            <input type="hidden" name="estado" value="reutilizado" />
                            <Button type="submit" variant="link" size="sm" className="h-auto p-0">
                              Reutilizar →
                            </Button>
                          </form>

                          <form action={updateReusableScrapStatusAction}>
                            <input type="hidden" name="id_retazo" value={item.id_retazo} />
                            <input type="hidden" name="estado" value="descartado" />
                            <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-destructive">
                              Descartar →
                            </Button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin acción</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}