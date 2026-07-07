import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";

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
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type AttendancePageProps = {
  searchParams?: Promise<SearchParamsRecord>;
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

function formatTime(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(value);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatHours(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${toNumber(value).toFixed(2)} h`;
}

function getAttendanceStatus(attendance: {
  falta: boolean;
  tardanza: boolean;
}) {
  if (attendance.falta) {
    return "Falta";
  }

  if (attendance.tardanza) {
    return "Tardanza";
  }

  return "Asistió";
}

function getAttendanceBadgeVariant(attendance: {
  falta: boolean;
  tardanza: boolean;
}) {
  if (attendance.falta) {
    return "destructive" as const;
  }

  if (attendance.tardanza) {
    return "warning" as const;
  }

  return "success" as const;
}

export default async function AttendancePage({
  searchParams,
}: AttendancePageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const operario = parseStringParam(params, "operario");
  const estado = parseStringParam(params, "estado");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );

  const filters: Prisma.asistenciaWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_asistencia: { contains: q, mode: "insensitive" } },
        {
          operario: {
            nombres: { contains: q, mode: "insensitive" },
          },
        },
        {
          operario: {
            apellidos: { contains: q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (operario) {
    filters.push({
      id_operario: { contains: operario, mode: "insensitive" },
    });
  }

  if (estado === "presente") {
    filters.push({ falta: false, tardanza: false });
  }

  if (estado === "tardanza") {
    filters.push({ falta: false, tardanza: true });
  }

  if (estado === "falta") {
    filters.push({ falta: true });
  }

  if (dateRange) {
    filters.push({ fecha: dateRange });
  }

  const where: Prisma.asistenciaWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const today = new Date();

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const startOfTomorrow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  );

  const [
    totalAttendance,
    attendanceToday,
    absencesToday,
    latenessToday,
    latestAttendance,
  ] = await Promise.all([
    prisma.asistencia.count({ where }),

    prisma.asistencia.count({
      where: {
        fecha: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
    }),

    prisma.asistencia.count({
      where: {
        fecha: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        falta: true,
      },
    }),

    prisma.asistencia.count({
      where: {
        fecha: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        tardanza: true,
      },
    }),

    prisma.asistencia.findMany({
      where,
      orderBy: [
        {
          fecha: "desc",
        },
        {
          id_asistencia: "desc",
        },
      ],
      take: 50,
      include: {
        operario: true,
        usuario: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Asistencia diaria"
        description="Registra y consulta la asistencia de los operarios del taller, incluyendo ingreso, salida, tardanzas, faltas, horas trabajadas y observaciones."
        backHref={navigationHrefs.staff}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Asistencia" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/staff/attendance/new">
              Registrar asistencia
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Buscar operario o codigo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operario">ID operario</Label>
              <Input id="operario" name="operario" defaultValue={operario} placeholder="ID operario" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <NativeSelect id="estado" name="estado" defaultValue={estado}>
                <option value="">Todos los estados</option>
                <option value="presente">Presente</option>
                <option value="tardanza">Tardanza</option>
                <option value="falta">Falta</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">Desde</Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={parseStringParam(params, "from")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Hasta</Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={parseStringParam(params, "to")}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">
                Filtrar
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/staff/attendance">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Registros totales" value={totalAttendance.toString()} description="Historial general de asistencia." tone="info" />
        <KpiCard title="Asistencias de hoy" value={attendanceToday.toString()} description="Registros creados para la fecha actual." tone="info" />
        <KpiCard title="Faltas de hoy" value={absencesToday.toString()} description="Operarios marcados como ausentes." tone={absencesToday > 0 ? "warning" : "info"} />
        <KpiCard title="Tardanzas de hoy" value={latenessToday.toString()} description="Registros marcados con tardanza." tone={latenessToday > 0 ? "warning" : "info"} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimos registros de asistencia
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {latestAttendance.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Todavía no hay asistencias registradas."
              description="Registra la primera asistencia diaria para empezar a reemplazar el control manual en cuaderno."
              action={
                <Button asChild>
                  <Link href="/dashboard/staff/attendance/new">
                    Registrar primera asistencia
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Operario</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {latestAttendance.map((attendance) => (
                  <TableRow key={attendance.id_asistencia}>
                    <TableCell className="font-mono text-xs">
                      {attendance.id_asistencia}
                    </TableCell>

                    <TableCell>{formatDate(attendance.fecha)}</TableCell>

                    <TableCell className="font-medium">
                      {attendance.operario.apellidos},{" "}
                      {attendance.operario.nombres}
                    </TableCell>

                    <TableCell>{formatTime(attendance.hora_ingreso)}</TableCell>

                    <TableCell>{formatTime(attendance.hora_salida)}</TableCell>

                    <TableCell className="text-right">
                      {formatHours(attendance.horas_trabajadas)}
                    </TableCell>

                    <TableCell className="text-right">
                      <Badge variant={getAttendanceBadgeVariant(attendance)}>
                        {getAttendanceStatus(attendance)}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {attendance.usuario.nombres}{" "}
                      {attendance.usuario.apellidos}
                    </TableCell>

                    <TableCell>{attendance.observaciones ?? "-"}</TableCell>
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
