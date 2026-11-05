import { CalendarCheck, ClipboardList, Clock, UserX } from "lucide-react";
import Link from "next/link";

import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
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
import { formatDate } from "@/lib/formatters";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import {
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { getAttendanceListData } from "@/modules/staff/attendance/queries";

type AttendancePageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

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
  // El panel de registro vuelve a la lista con sus filtros.
  const returnTo = createReturnToHref(navigationHrefs.attendance, params);
  const q = parseStringParam(params, "q");
  const operario = parseStringParam(params, "operario");
  const estado = parseStringParam(params, "estado");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const today = new Date();

  const {
    totalAttendance,
    attendanceToday,
    absencesToday,
    latenessToday,
    latestAttendance,
  } = await getAttendanceListData({ q, operario, estado, from, to }, today);

  return (
    <div className="space-y-6">
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
            <Link href={withReturnTo(`${navigationHrefs.attendance}/new`, returnTo)}>
              Registrar asistencia
            </Link>
          </Button>
        }
      />

      <FilterBar action={navigationHrefs.attendance} label="Filtros de asistencia" clearHref={navigationHrefs.attendance}>
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar operario o codigo" />}
        </Field>

        <Field id="operario" label="ID operario">
          {(control) => <Input {...control} name="operario" defaultValue={operario} placeholder="ID operario" />}
        </Field>

        <Field id="estado" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="estado" defaultValue={estado}>
              <option value="">Todos los estados</option>
              <option value="presente">Presente</option>
              <option value="tardanza">Tardanza</option>
              <option value="falta">Falta</option>
            </NativeSelect>
          )}
        </Field>

        <DateRangeFields
          id="fecha"
          defaultFrom={parseStringParam(params, "from")}
          defaultTo={parseStringParam(params, "to")}
        />
      </FilterBar>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Registros totales" value={totalAttendance.toString()} description="Historial general de asistencia." tone="info" icon={ClipboardList} />
        <KpiCard title="Asistencias de hoy" value={attendanceToday.toString()} description="Registros creados para la fecha actual." tone="info" icon={CalendarCheck} />
        <KpiCard title="Faltas de hoy" value={absencesToday.toString()} description="Operarios marcados como ausentes." tone={absencesToday > 0 ? "warning" : "info"} icon={UserX} />
        <KpiCard title="Tardanzas de hoy" value={latenessToday.toString()} description="Registros marcados con tardanza." tone={latenessToday > 0 ? "warning" : "info"} icon={Clock} />
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
                  <Link href={withReturnTo(`${navigationHrefs.attendance}/new`, returnTo)}>
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

                    <TableCell>{formatDate(attendance.fecha, { format: "dd/mm/yyyy" })}</TableCell>

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
    </div>
  );
}
