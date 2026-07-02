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
    "default" | "secondary" | "destructive" | "outline"
  > = {
    operativa: "default",
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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Mantenimiento de maquinaria - Maquinas
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Listado de maquinas
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta maquinas del taller, estado operativo, ubicacion, codigo
            interno y trazabilidad relacionada.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/maintenance"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al modulo
          </Link>
          {canManageMachines ? (
            <Link
              href="/dashboard/maintenance/machines/new"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Registrar maquina
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maquinas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{machines.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operativas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{operationalMachines.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inactivas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{inactiveMachines.length}</p>
          </CardContent>
        </Card>
      </section>

      <form
        action="/dashboard/maintenance/machines"
        className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-5"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar maquina..."
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          name="type"
          defaultValue={type}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los tipos</option>
          {types.map((item) => (
            <option key={item.tipo} value={item.tipo}>
              {item.tipo}
            </option>
          ))}
        </select>
        <select
          name="location"
          defaultValue={location}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todas las ubicaciones</option>
          {locations.map((item) =>
            item.ubicacion ? (
              <option key={item.ubicacion} value={item.ubicacion}>
                {item.ubicacion}
              </option>
            ) : null,
          )}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="operativa">Operativa</option>
          <option value="en_reparacion">En mantenimiento</option>
          <option value="dada_de_baja">Fuera de servicio</option>
          <option value="inactiva">Inactiva</option>
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Filtrar
          </button>
          <Link
            href="/dashboard/maintenance/machines"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Limpiar
          </Link>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maquinas registradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3">Codigo</th>
                  <th className="py-2 pr-3">Maquina</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Ubicacion</th>
                  <th className="py-2 pr-3">Codigo interno</th>
                  <th className="py-2 pr-3">Registro</th>
                  <th className="py-2 pr-3 text-right">Fallas</th>
                  <th className="py-2 pr-3 text-right">Preventivos</th>
                  <th className="py-2 pr-3 text-right">Etapas</th>
                  <th className="py-2 pr-3 text-right">Estado</th>
                  {canManageMachines ? (
                    <th className="py-2 text-right">Acciones</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {machines.map((machine) => (
                  <tr key={machine.id_maquina} className="border-b align-top">
                    <td className="py-2 pr-3 font-mono text-xs">
                      {machine.id_maquina}
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      {machine.nombre}
                      <p className="text-xs font-normal text-muted-foreground">
                        {machine.observaciones ?? "Sin observaciones"}
                      </p>
                    </td>
                    <td className="py-2 pr-3">{machine.tipo}</td>
                    <td className="py-2 pr-3">{machine.ubicacion ?? "-"}</td>
                    <td className="py-2 pr-3">
                      {machine.codigo_interno ?? "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {formatDate(machine.fecha_registro)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {machine._count.falla_maquina}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {machine._count.mantenimiento_preventivo}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {machine._count.etapa_ruta_maquina}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Badge
                        variant={getMachineStatusBadgeVariant(machine.estado)}
                      >
                        {getMachineStatusLabel(machine.estado)}
                      </Badge>
                    </td>
                    {canManageMachines ? (
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/maintenance/machines/${machine.id_maquina}/edit`}
                            className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                          >
                            Editar
                          </Link>
                          <form action={toggleMachineStatusAction}>
                            <input
                              type="hidden"
                              name="id_maquina"
                              value={machine.id_maquina}
                            />
                            <button
                              type="submit"
                              className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                            >
                              {machine.estado === "inactiva"
                                ? "Activar"
                                : "Inactivar"}
                            </button>
                          </form>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {machines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageMachines ? 11 : 10}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Aun no hay maquinas registradas.
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
