import Link from "next/link";

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

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatHours(value: unknown) {
  return `${toNumber(value).toFixed(2)} h`;
}

export default async function StaffDashboardPage() {
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

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    totalOperators,
    activeOperators,
    inactiveOperators,
    attendanceToday,
    absencesToday,
    tasksThisMonth,
    pendingPayrolls,
    latestOperators,
    latestAttendance,
  ] = await Promise.all([
    prisma.operario.count(),

    prisma.operario.count({
      where: {
        estado: "activo",
      },
    }),

    prisma.operario.count({
      where: {
        estado: {
          not: "activo",
        },
      },
    }),

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

    prisma.tarea_operario.count({
      where: {
        fecha_tarea: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "pendiente",
      },
    }),

    prisma.operario.findMany({
      orderBy: [
        {
          estado: "asc",
        },
        {
          apellidos: "asc",
        },
      ],
      take: 6,
    }),

    prisma.asistencia.findMany({
      orderBy: {
        fecha: "desc",
      },
      take: 6,
      include: {
        operario: true,
      },
    }),
  ]);

  const quickLinks = [
    {
      title: "Operarios",
      description: "Registrar y consultar trabajadores del taller.",
      href: "/dashboard/staff/operators",
      roles: "ADMIN",
    },
    {
      title: "Asistencia diaria",
      description: "Registrar ingreso, salida, tardanza o falta.",
      href: "/dashboard/staff/attendance",
      roles: "ADMIN",
    },
    {
      title: "Tareas diarias",
      description: "Registrar actividades realizadas por operario.",
      href: "/dashboard/staff/tasks",
      roles: "ADMIN / Maestro de taller",
    },
    {
      title: "Planillas",
      description: "Generar pagos según asistencia y modalidad.",
      href: "/dashboard/staff/payrolls",
      roles: "ADMIN",
    },
    {
      title: "Historial de pagos",
      description: "Consultar pagos realizados a operarios.",
      href: "/dashboard/staff/payment-history",
      roles: "ADMIN",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Fase 8</p>
        <h1 className="text-3xl font-bold tracking-tight">
          Personal, asistencia y pagos
        </h1>
        <p className="mt-2 text-muted-foreground">
          Control de operarios, asistencia diaria, tareas realizadas,
          modalidades de pago, planillas e historial de pagos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Operarios registrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalOperators}</p>
            <p className="text-xs text-muted-foreground">
              Total de trabajadores registrados.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Operarios activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeOperators}</p>
            <p className="text-xs text-muted-foreground">
              Inactivos o retirados: {inactiveOperators}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Asistencias de hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{attendanceToday}</p>
            <p className="text-xs text-muted-foreground">
              Faltas registradas hoy: {absencesToday}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Planillas pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingPayrolls}</p>
            <p className="text-xs text-muted-foreground">
              Tareas registradas este mes: {tasksThisMonth}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">{link.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {link.description}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Acceso: {link.roles}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimos operarios registrados</CardTitle>
          </CardHeader>
          <CardContent>
            {latestOperators.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay operarios registrados.
              </p>
            ) : (
              <div className="space-y-3">
                {latestOperators.map((operator) => (
                  <div
                    key={operator.id_operario}
                    className="rounded-lg border p-3"
                  >
                    <p className="font-medium">
                      {operator.apellidos}, {operator.nombres}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Cargo: {operator.cargo ?? "-"} · Modalidad:{" "}
                      {operator.modalidad_pago}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Estado: {operator.estado}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas asistencias</CardTitle>
          </CardHeader>
          <CardContent>
            {latestAttendance.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay asistencias registradas.
              </p>
            ) : (
              <div className="space-y-3">
                {latestAttendance.map((attendance) => (
                  <div
                    key={attendance.id_asistencia}
                    className="rounded-lg border p-3"
                  >
                    <p className="font-medium">
                      {attendance.operario.apellidos},{" "}
                      {attendance.operario.nombres}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Fecha: {formatDate(attendance.fecha)} · Horas:{" "}
                      {formatHours(attendance.horas_trabajadas)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Falta: {attendance.falta ? "Sí" : "No"} · Tardanza:{" "}
                      {attendance.tardanza ? "Sí" : "No"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}