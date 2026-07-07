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
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { toggleMachineStatusAction } from "@/modules/maintenance/machines/actions";

type MachinesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

function getMachineStatusLabel(status: string) {
  const labels: Record<string, string> = {
    operativa: "Operativa",
    en_reparacion: "En mantenimiento",
    dada_de_baja: "Fuera de servicio",
    inactiva: "Inactiva",
  };

  return labels[status] ?? status;
}

function getMachineStatusBadgeVariant(status: string) {
  const variants: Record<
    string,
    "success" | "secondary" | "destructive" | "outline"
  > = {
    operativa: "success",
    en_reparacion: "secondary",
    dada_de_baja: "destructive",
    inactiva: "outline",
  };

  return variants[status] ?? "secondary";
}

export default async function MachinesPage({ searchParams }: MachinesPageProps) {
  const session = await requireRole([
    APP_ROLES.ADMIN,
    APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canManageMachines = session.user.role === APP_ROLES.ADMIN;
  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const type = getSearchParam(params, "type");
  const location = getSearchParam(params, "location");
  const status = getSearchParam(params, "status");
  const returnTo = createReturnToHref(navigationHrefs.machines, params);
  const filters: Prisma.maquinaWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          nombre: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          codigo_interno: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (type) {
    filters.push({
      tipo: type,
    });
  }

  if (location) {
    filters.push({
      ubicacion: location,
    });
  }

  if (status) {
    filters.push({
      estado: status,
    });
  }

  const where: Prisma.maquinaWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [machines, types, locations] = await Promise.all([
    prisma.maquina.findMany({
      where,
      orderBy: [
        {
          estado: "asc",
        },
        {
          nombre: "asc",
        },
      ],
      include: {
        _count: {
          select: {
            falla_maquina: true,
            mantenimiento_preventivo: true,
            etapa_ruta_maquina: true,
          },
        },
      },
    }),
    prisma.maquina.findMany({
      distinct: ["tipo"],
      orderBy: {
        tipo: "asc",
      },
      select: {
        tipo: true,
      },
    }),
    prisma.maquina.findMany({
      where: {
        ubicacion: {
          not: null,
        },
      },
      distinct: ["ubicacion"],
      orderBy: {
        ubicacion: "asc",
      },
      select: {
        ubicacion: true,
      },
    }),
  ]);

  const operationalMachines = machines.filter(
    (machine) => machine.estado === "operativa",
  );
  const inactiveMachines = machines.filter(
    (machine) => machine.estado === "inactiva",
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Máquinas"
        description="Consulta máquinas del taller, estado operativo, ubicación, código interno y trazabilidad relacionada."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Máquinas" },
        ])}
        actions={
          canManageMachines ? (
            <Button asChild>
              <Link href={`${navigationHrefs.machines}/new`}>
                Registrar máquina
              </Link>
            </Button>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Maquinas registradas" value={machines.length.toString()} description="Total de equipos registrados." tone="info" />
        <KpiCard title="Operativas" value={operationalMachines.length.toString()} description="Disponibles para producción." tone="success" />
        <KpiCard title="Inactivas" value={inactiveMachines.length.toString()} description="Fuera de operación." tone="warning" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action="/dashboard/maintenance/machines"
            className="grid gap-3 md:grid-cols-5"
          >
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Buscar maquina..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <NativeSelect id="type" name="type" defaultValue={type}>
                <option value="">Todos los tipos</option>
                {types.map((item) => (
                  <option key={item.tipo} value={item.tipo}>
                    {item.tipo}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <NativeSelect id="location" name="location" defaultValue={location}>
                <option value="">Todas las ubicaciones</option>
                {locations.map((item) =>
                  item.ubicacion ? (
                    <option key={item.ubicacion} value={item.ubicacion}>
                      {item.ubicacion}
                    </option>
                  ) : null,
                )}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <NativeSelect id="status" name="status" defaultValue={status}>
                <option value="">Todos los estados</option>
                <option value="operativa">Operativa</option>
                <option value="en_reparacion">En mantenimiento</option>
                <option value="dada_de_baja">Fuera de servicio</option>
                <option value="inactiva">Inactiva</option>
              </NativeSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">
                Filtrar
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/maintenance/machines">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maquinas registradas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {machines.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Aun no hay maquinas registradas."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Código interno</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="text-right">Fallas</TableHead>
                  <TableHead className="text-right">Preventivos</TableHead>
                  <TableHead className="text-right">Etapas</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  {canManageMachines ? (
                    <TableHead className="text-right">Acciones</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines.map((machine) => (
                  <TableRow key={machine.id_maquina} className="align-top">
                    <TableCell className="font-mono text-xs">
                      {machine.id_maquina}
                    </TableCell>
                    <TableCell className="font-medium">
                      {machine.nombre}
                      <p className="text-xs font-normal text-muted-foreground">
                        {machine.observaciones ?? "Sin observaciones"}
                      </p>
                    </TableCell>
                    <TableCell>{machine.tipo}</TableCell>
                    <TableCell>{machine.ubicacion ?? "-"}</TableCell>
                    <TableCell>{machine.codigo_interno ?? "-"}</TableCell>
                    <TableCell>{formatDate(machine.fecha_registro)}</TableCell>
                    <TableCell className="text-right">
                      {machine._count.falla_maquina}
                    </TableCell>
                    <TableCell className="text-right">
                      {machine._count.mantenimiento_preventivo}
                    </TableCell>
                    <TableCell className="text-right">
                      {machine._count.etapa_ruta_maquina}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={getMachineStatusBadgeVariant(machine.estado)}>
                        {getMachineStatusLabel(machine.estado)}
                      </Badge>
                    </TableCell>
                    {canManageMachines ? (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={withReturnTo(
                                `${navigationHrefs.machines}/${machine.id_maquina}/edit`,
                                returnTo,
                              )}
                            >
                              Editar
                            </Link>
                          </Button>
                          <form action={toggleMachineStatusAction}>
                            <input
                              type="hidden"
                              name="id_maquina"
                              value={machine.id_maquina}
                            />
                            <Button type="submit" variant="outline" size="sm">
                              {machine.estado === "inactiva"
                                ? "Activar"
                                : "Inactivar"}
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    ) : null}
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

