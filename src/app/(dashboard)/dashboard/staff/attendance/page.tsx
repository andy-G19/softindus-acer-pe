import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";

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
    return "destructive";
  }

  if (attendance.tardanza) {
    return "secondary";
  }

  return "default";
}

export default async function AttendancePage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

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
    prisma.asistencia.count(),

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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Asistencia
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Asistencia diaria
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra y consulta la asistencia de los operarios del taller,
            incluyendo ingreso, salida, tardanzas, faltas, horas trabajadas y
            observaciones.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/staff"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Link
            href="/dashboard/staff/attendance/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Registrar asistencia
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registros totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAttendance}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Historial general de asistencia.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asistencias de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{attendanceToday}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Registros creados para la fecha actual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faltas de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{absencesToday}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Operarios marcados como ausentes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tardanzas de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{latenessToday}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Registros marcados con tardanza.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimos registros de asistencia
          </CardTitle>
        </CardHeader>

        <CardContent>
          {latestAttendance.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Todavía no hay asistencias registradas.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Registra la primera asistencia diaria para empezar a reemplazar
                el control manual en cuaderno.
              </p>

              <Link
                href="/dashboard/staff/attendance/new"
                className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Registrar primera asistencia
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Operario</th>
                    <th className="py-2 pr-3">Ingreso</th>
                    <th className="py-2 pr-3">Salida</th>
                    <th className="py-2 pr-3 text-right">Horas</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    <th className="py-2 pr-3">Registrado por</th>
                    <th className="py-2">Observaciones</th>
                  </tr>
                </thead>

                <tbody>
                  {latestAttendance.map((attendance) => (
                    <tr key={attendance.id_asistencia} className="border-b">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {attendance.id_asistencia}
                      </td>

                      <td className="py-2 pr-3">
                        {formatDate(attendance.fecha)}
                      </td>

                      <td className="py-2 pr-3 font-medium">
                        {attendance.operario.apellidos},{" "}
                        {attendance.operario.nombres}
                      </td>

                      <td className="py-2 pr-3">
                        {formatTime(attendance.hora_ingreso)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatTime(attendance.hora_salida)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatHours(attendance.horas_trabajadas)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        <Badge
                          variant={getAttendanceBadgeVariant(attendance)}
                        >
                          {getAttendanceStatus(attendance)}
                        </Badge>
                      </td>

                      <td className="py-2 pr-3">
                        {attendance.usuario.nombres}{" "}
                        {attendance.usuario.apellidos}
                      </td>

                      <td className="py-2">
                        {attendance.observaciones ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}