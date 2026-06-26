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
import { toggleOperatorStatusAction } from "@/modules/staff/operators/actions";

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

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function getPaymentModeLabel(mode: string) {
  const labels: Record<string, string> = {
    semanal: "Semanal",
    quincenal: "Quincenal",
    mensual: "Mensual",
  };

  return labels[mode] ?? mode;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    activo: "Activo",
    inactivo: "Inactivo",
  };

  return labels[status] ?? status;
}

function getStatusBadgeVariant(status: string) {
  return status === "activo" ? "default" : "secondary";
}

export default async function OperatorsPage() {
  const session = await requireRole([
    APP_ROLES.ADMIN,
    APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canManageOperators = session.user.role === APP_ROLES.ADMIN;

  const operators = await prisma.operario.findMany({
    orderBy: [
      {
        estado: "asc",
      },
      {
        apellidos: "asc",
      },
      {
        nombres: "asc",
      },
    ],
    include: {
      _count: {
        select: {
          asistencia: true,
          tarea_operario: true,
          planilla_pago: true,
        },
      },
    },
  });

  const activeOperators = operators.filter(
    (operator) => operator.estado === "activo",
  );

  const inactiveOperators = operators.filter(
    (operator) => operator.estado !== "activo",
  );

  const weeklyOperators = operators.filter(
    (operator) => operator.modalidad_pago === "semanal",
  );

  const biweeklyOperators = operators.filter(
    (operator) => operator.modalidad_pago === "quincenal",
  );

  const monthlyOperators = operators.filter(
    (operator) => operator.modalidad_pago === "mensual",
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Operarios
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Listado de operarios
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta los trabajadores registrados del taller, su modalidad de
            pago, tarifa, estado laboral y trazabilidad relacionada con
            asistencia, tareas y planillas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/staff"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          {canManageOperators ? (
            <Link
              href="/dashboard/staff/operators/new"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Registrar operario
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operarios registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{operators.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total histórico de trabajadores.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeOperators.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Inactivos: {inactiveOperators.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pago semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{weeklyOperators.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quincenal: {biweeklyOperators.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pago mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{monthlyOperators.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Según configuración laboral.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operarios registrados</CardTitle>
        </CardHeader>

        <CardContent>
          {operators.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Aún no hay operarios registrados.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Registra el primer operario para empezar a controlar asistencia,
                tareas y planillas.
              </p>

              {canManageOperators ? (
                <Link
                  href="/dashboard/staff/operators/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar primer operario
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Operario</th>
                    <th className="py-2 pr-3">Cargo</th>
                    <th className="py-2 pr-3">Especialidad</th>
                    <th className="py-2 pr-3">Modalidad</th>
                    <th className="py-2 pr-3 text-right">Tarifa</th>
                    <th className="py-2 pr-3">Ingreso</th>
                    <th className="py-2 pr-3 text-right">Asist.</th>
                    <th className="py-2 pr-3 text-right">Tareas</th>
                    <th className="py-2 pr-3 text-right">Planillas</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    {canManageOperators ? (
                      <th className="py-2 text-right">Acción</th>
                    ) : null}
                  </tr>
                </thead>

                <tbody>
                  {operators.map((operator) => (
                    <tr key={operator.id_operario} className="border-b">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {operator.id_operario}
                      </td>

                      <td className="py-2 pr-3 font-medium">
                        {operator.apellidos}, {operator.nombres}
                        <p className="text-xs font-normal text-muted-foreground">
                          {operator.telefono ?? "Sin teléfono"}
                        </p>
                      </td>

                      <td className="py-2 pr-3">{operator.cargo ?? "-"}</td>

                      <td className="py-2 pr-3">
                        {operator.especialidad ?? "-"}
                      </td>

                      <td className="py-2 pr-3">
                        {getPaymentModeLabel(operator.modalidad_pago)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatMoney(operator.tarifa)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatDate(operator.fecha_ingreso)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {operator._count.asistencia}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {operator._count.tarea_operario}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {operator._count.planilla_pago}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        <Badge variant={getStatusBadgeVariant(operator.estado)}>
                          {getStatusLabel(operator.estado)}
                        </Badge>
                      </td>

                      {canManageOperators ? (
                        <td className="py-2 text-right">
                          <form action={toggleOperatorStatusAction}>
                            <input
                              type="hidden"
                              name="id_operario"
                              value={operator.id_operario}
                            />

                            <button
                              type="submit"
                              className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                            >
                              {operator.estado === "activo"
                                ? "Desactivar"
                                : "Activar"}
                            </button>
                          </form>
                        </td>
                      ) : null}
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