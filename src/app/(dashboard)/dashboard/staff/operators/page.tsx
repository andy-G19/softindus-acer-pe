import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import { toggleOperatorStatusAction } from "@/modules/staff/operators/actions";

type OperatorsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
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

function getStatusLabel(status: string) {
  return status === "activo" ? "Activo" : "Inactivo";
}

export default async function OperatorsPage({
  searchParams,
}: OperatorsPageProps) {
  const session = await requireRole([
    APP_ROLES.ADMIN,
    APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canManageOperators = session.user.role === APP_ROLES.ADMIN;
  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const cargo = getSearchParam(params, "cargo");
  const especialidad = getSearchParam(params, "especialidad");
  const modalidad = getSearchParam(params, "modalidad");
  const status = getSearchParam(params, "status");
  const filters: Prisma.operarioWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          nombres: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          apellidos: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          cargo: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          telefono: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (cargo) {
    filters.push({
      cargo,
    });
  }

  if (especialidad) {
    filters.push({
      especialidad,
    });
  }

  if (modalidad) {
    filters.push({
      modalidad_pago: modalidad,
    });
  }

  if (status) {
    filters.push({
      estado: status,
    });
  }

  const where: Prisma.operarioWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [operators, cargos, especialidades, modalidades] = await Promise.all([
    prisma.operario.findMany({
      where,
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
    }),
    prisma.operario.findMany({
      where: {
        cargo: {
          not: null,
        },
      },
      distinct: ["cargo"],
      orderBy: {
        cargo: "asc",
      },
      select: {
        cargo: true,
      },
    }),
    prisma.operario.findMany({
      where: {
        especialidad: {
          not: null,
        },
      },
      distinct: ["especialidad"],
      orderBy: {
        especialidad: "asc",
      },
      select: {
        especialidad: true,
      },
    }),
    prisma.operario.findMany({
      distinct: ["modalidad_pago"],
      orderBy: {
        modalidad_pago: "asc",
      },
      select: {
        modalidad_pago: true,
      },
    }),
  ]);

  const activeOperators = operators.filter(
    (operator) => operator.estado === "activo",
  );
  const inactiveOperators = operators.filter(
    (operator) => operator.estado === "inactivo",
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Personal, asistencia y pagos - Operarios
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Listado de operarios
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta operarios del taller, modalidad de pago y trazabilidad
            relacionada con asistencia, tareas y planillas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/staff"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al modulo
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

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operarios registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{operators.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeOperators.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inactivos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{inactiveOperators.length}</p>
          </CardContent>
        </Card>
      </section>

      <form
        action="/dashboard/staff/operators"
        className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-6"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar operario..."
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          name="cargo"
          defaultValue={cargo}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los cargos</option>
          {cargos.map((item) =>
            item.cargo ? (
              <option key={item.cargo} value={item.cargo}>
                {item.cargo}
              </option>
            ) : null,
          )}
        </select>
        <select
          name="especialidad"
          defaultValue={especialidad}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Especialidad</option>
          {especialidades.map((item) =>
            item.especialidad ? (
              <option key={item.especialidad} value={item.especialidad}>
                {item.especialidad}
              </option>
            ) : null,
          )}
        </select>
        <select
          name="modalidad"
          defaultValue={modalidad}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Modalidad</option>
          {modalidades.map((item) => (
            <option key={item.modalidad_pago} value={item.modalidad_pago}>
              {item.modalidad_pago}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Filtrar
          </button>
          <Link
            href="/dashboard/staff/operators"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Limpiar
          </Link>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operarios registrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3">Codigo</th>
                  <th className="py-2 pr-3">Operario</th>
                  <th className="py-2 pr-3">Cargo</th>
                  <th className="py-2 pr-3">Especialidad</th>
                  <th className="py-2 pr-3">Modalidad</th>
                  <th className="py-2 pr-3 text-right">Tarifa</th>
                  <th className="py-2 pr-3 text-right">Asist.</th>
                  <th className="py-2 pr-3 text-right">Tareas</th>
                  <th className="py-2 pr-3 text-right">Planillas</th>
                  <th className="py-2 pr-3 text-right">Estado</th>
                  {canManageOperators ? (
                    <th className="py-2 text-right">Acciones</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {operators.map((operator) => (
                  <tr key={operator.id_operario} className="border-b align-top">
                    <td className="py-2 pr-3 font-mono text-xs">
                      {operator.id_operario}
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      {operator.apellidos}, {operator.nombres}
                      <p className="text-xs font-normal text-muted-foreground">
                        {operator.telefono ?? "Sin telefono"}
                      </p>
                    </td>
                    <td className="py-2 pr-3">{operator.cargo ?? "-"}</td>
                    <td className="py-2 pr-3">
                      {operator.especialidad ?? "-"}
                    </td>
                    <td className="py-2 pr-3">{operator.modalidad_pago}</td>
                    <td className="py-2 pr-3 text-right">
                      {formatMoney(operator.tarifa)}
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
                      <Badge
                        variant={
                          operator.estado === "activo" ? "default" : "secondary"
                        }
                      >
                        {getStatusLabel(operator.estado)}
                      </Badge>
                    </td>
                    {canManageOperators ? (
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/staff/operators/${operator.id_operario}/edit`}
                            className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                          >
                            Editar
                          </Link>
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
                                ? "Inactivar"
                                : "Activar"}
                            </button>
                          </form>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {operators.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageOperators ? 11 : 10}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Todavia no hay operarios registrados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
