import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
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
import { dashboardBreadcrumbs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type PageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function AuditPage({ searchParams }: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const usuario = parseStringParam(params, "usuario");
  const accion = parseStringParam(params, "accion");
  const entidad = parseStringParam(params, "entidad");
  const from = parseStringParam(params, "from");
  const to = parseStringParam(params, "to");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );

  const filters: Prisma.bitacora_operacionWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { detalle: { contains: q, mode: "insensitive" } },
        { accion: { contains: q, mode: "insensitive" } },
        { entidad_afectada: { contains: q, mode: "insensitive" } },
        { id_registro_afectado: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (usuario) {
    filters.push({ id_usuario: usuario });
  }

  if (accion) {
    filters.push({ accion });
  }

  if (entidad) {
    filters.push({ entidad_afectada: entidad });
  }

  if (dateRange) {
    filters.push({ fecha_hora: dateRange });
  }

  const where: Prisma.bitacora_operacionWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [users, actions, entities, logs, totalLogs] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
      },
    }),
    prisma.bitacora_operacion.findMany({
      distinct: ["accion"],
      orderBy: {
        accion: "asc",
      },
      select: {
        accion: true,
      },
    }),
    prisma.bitacora_operacion.findMany({
      distinct: ["entidad_afectada"],
      orderBy: {
        entidad_afectada: "asc",
      },
      select: {
        entidad_afectada: true,
      },
    }),
    prisma.bitacora_operacion.findMany({
      where,
      orderBy: {
        fecha_hora: "desc",
      },
      take: 150,
      include: {
        usuario: true,
      },
    }),
    prisma.bitacora_operacion.count({ where }),
  ]);

  const exportParams = {
    q,
    usuario,
    accion,
    entidad,
    from,
    to,
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Bitácora de operaciones"
        description="Consulta solo lectura de acciones críticas, entidades afectadas, usuarios responsables, fecha, detalle e IP registrada."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Auditoría" }])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={buildReportExportHref("audit", exportParams)}>
                Exportar Excel
              </Link>
            </Button>
            <Button asChild>
              <Link href={buildReportExportHref("audit", exportParams, "pdf")}>
                Exportar PDF
              </Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Buscar detalle, entidad o accion" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usuario">Usuario</Label>
              <NativeSelect id="usuario" name="usuario" defaultValue={usuario}>
                <option value="">Todos los usuarios</option>
                {users.map((user) => (
                  <option key={user.id_usuario} value={user.id_usuario}>
                    {user.apellidos}, {user.nombres}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accion">Acción</Label>
              <NativeSelect id="accion" name="accion" defaultValue={accion}>
                <option value="">Todas las acciones</option>
                {actions.map((item) => (
                  <option key={item.accion} value={item.accion}>
                    {item.accion}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entidad">Entidad</Label>
              <NativeSelect id="entidad" name="entidad" defaultValue={entidad}>
                <option value="">Todas las entidades</option>
                {entities.map((item) => (
                  <option key={item.entidad_afectada} value={item.entidad_afectada}>
                    {item.entidad_afectada}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">Desde</Label>
              <Input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Hasta</Label>
              <Input id="to" name="to" type="date" defaultValue={to} />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Filtrar</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/audit">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Operaciones" value={totalLogs.toString()} description="Coincidencias segun filtros." tone="info" />
        <KpiCard title="Usuarios" value={new Set(logs.map((log) => log.id_usuario)).size.toString()} description="Usuarios en la vista actual." tone="info" />
        <KpiCard title="Entidades" value={new Set(logs.map((log) => log.entidad_afectada)).size.toString()} description="Entidades afectadas." tone="info" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operaciones registradas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {logs.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron operaciones con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id_bitacora} className="align-top">
                    <TableCell>{formatDateTime(log.fecha_hora)}</TableCell>
                    <TableCell>
                      {log.usuario.apellidos}, {log.usuario.nombres}
                    </TableCell>
                    <TableCell>{log.accion}</TableCell>
                    <TableCell>{log.entidad_afectada}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.id_registro_afectado ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-xl">
                      {log.detalle ?? "-"}
                    </TableCell>
                    <TableCell>{log.ip_origen ?? "-"}</TableCell>
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


