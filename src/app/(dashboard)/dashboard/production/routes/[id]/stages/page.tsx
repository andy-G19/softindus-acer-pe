import Link from "next/link";
import { notFound } from "next/navigation";
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
import { toggleRouteStageStatusAction } from "@/modules/production/stages/actions";

type RouteStagesPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatHours(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Number(value.toString()).toFixed(2)} h`;
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

function getBooleanFilter(value: string) {
  if (value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  return undefined;
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

export default async function RouteStagesPage({
  params,
  searchParams,
}: RouteStagesPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const q = getSearchParam(queryParams, "q");
  const requiresMachine = getSearchParam(queryParams, "requiresMachine");
  const status = getSearchParam(queryParams, "status");
  const machineFilter = getBooleanFilter(requiresMachine);
  const statusFilter = getStatusFilter(status);
  const stageFilters: Prisma.etapa_rutaWhereInput[] = [];

  if (q) {
    stageFilters.push({
      nombre_etapa: {
        contains: q,
        mode: "insensitive",
      },
    });
  }

  if (machineFilter !== undefined) {
    stageFilters.push({
      requiere_maquina: machineFilter,
    });
  }

  if (statusFilter !== undefined) {
    stageFilters.push({
      estado: statusFilter,
    });
  }

  const route = await prisma.ruta_fabricacion.findUnique({
    where: {
      id_ruta: id,
    },
    include: {
      producto: true,
      etapa_ruta: {
        where: stageFilters.length > 0 ? { AND: stageFilters } : undefined,
        include: {
          _count: {
            select: {
              avance_orden: true,
              tarea_operario: true,
            },
          },
        },
        orderBy: {
          orden_secuencia: "asc",
        },
      },
    },
  });

  if (!route) {
    notFound();
  }

  const totalEstimatedHours = route.etapa_ruta.reduce((total, stage) => {
    if (!stage.tiempo_estimado_horas) {
      return total;
    }

    return total + Number(stage.tiempo_estimado_horas.toString());
  }, 0);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Etapas de la ruta"
        description={`Ruta: ${route.nombre_ruta} · Producto: ${route.producto.nombre_producto}${route.descripcion ? ` · ${route.descripcion}` : ""}`}
        backHref={`${navigationHrefs.routes}`}
        backLabel="Volver a rutas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas", href: navigationHrefs.routes },
          { label: "Etapas" },
        ])}
        actions={
          <Button asChild>
            <Link href={`/dashboard/production/routes/${route.id_ruta}/stages/new`}>
              Nueva etapa
            </Link>
          </Button>
        }
      />

      <form className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[1.5fr_1fr_1fr_auto_auto]">
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar etapa..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="requiresMachine">Máquina</Label>
          <NativeSelect
            id="requiresMachine"
            name="requiresMachine"
            defaultValue={requiresMachine}
          >
            <option value="">Máquina: todos</option>
            <option value="yes">Requiere máquina</option>
            <option value="no">No requiere máquina</option>
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
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/dashboard/production/routes/${route.id_ruta}/stages`}>
              Limpiar filtros
            </Link>
          </Button>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Etapas registradas" value={route.etapa_ruta.length.toString()} description="Total en esta ruta." tone="info" />
        <KpiCard
          title="Etapas activas"
          value={route.etapa_ruta.filter((stage) => stage.estado).length.toString()}
          description="Disponibles para producción."
          tone="success"
        />
        <KpiCard
          title="Requieren máquina"
          value={route.etapa_ruta.filter((stage) => stage.requiere_maquina).length.toString()}
          description="Dependen de equipo crítico."
          tone="warning"
        />
        <KpiCard title="Tiempo estimado total" value={`${totalEstimatedHours.toFixed(2)} h`} description="Suma de etapas activas." tone="info" />
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Orden</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Tiempo estimado</TableHead>
            <TableHead>Máquina</TableHead>
            <TableHead>Avances</TableHead>
            <TableHead>Tareas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {route.etapa_ruta.map((stage) => (
            <TableRow key={stage.id_etapa_ruta}>
              <TableCell className="text-xs">
                {stage.orden_secuencia}
              </TableCell>

              <TableCell>
                <div className="font-medium">{stage.nombre_etapa}</div>

                {stage.descripcion ? (
                  <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                    {stage.descripcion}
                  </p>
                ) : null}
              </TableCell>

              <TableCell>{formatHours(stage.tiempo_estimado_horas)}</TableCell>

              <TableCell>
                <Badge variant={stage.requiere_maquina ? "warning" : "outline"}>
                  {stage.requiere_maquina ? "Requiere" : "No requiere"}
                </Badge>
              </TableCell>

              <TableCell>{stage._count.avance_orden}</TableCell>

              <TableCell>{stage._count.tarea_operario}</TableCell>

              <TableCell>
                <Badge variant={stage.estado ? "success" : "outline"}>
                  {stage.estado ? "Activa" : "Inactiva"}
                </Badge>
              </TableCell>

              <TableCell>
                <div className="flex flex-col gap-2">
                  <Button variant="link" className="h-auto justify-start p-0" asChild>
                    <Link
                      href={`/dashboard/production/routes/${route.id_ruta}/stages/${stage.id_etapa_ruta}/edit`}
                    >
                      Editar
                    </Link>
                  </Button>

                  <form action={toggleRouteStageStatusAction}>
                    <input
                      type="hidden"
                      name="id_etapa_ruta"
                      value={stage.id_etapa_ruta}
                    />

                    <Button
                      type="submit"
                      variant="link"
                      className="h-auto justify-start p-0"
                    >
                      {stage.estado ? "Inactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}

          {route.etapa_ruta.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Esta ruta todavía no tiene etapas registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
