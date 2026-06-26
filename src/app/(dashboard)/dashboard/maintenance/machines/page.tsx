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
import { updateMachineStatusAction } from "@/modules/maintenance/machines/actions";

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

export default async function MachinesPage() {
  const session = await requireRole([
    APP_ROLES.ADMIN,
    APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canManageMachines = session.user.role === APP_ROLES.ADMIN;

  const machines = await prisma.maquina.findMany({
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
  });

  const operationalMachines = machines.filter(
    (machine) => machine.estado === "operativa",
  );

  const maintenanceMachines = machines.filter(
    (machine) => machine.estado === "en_reparacion",
  );

  const outOfServiceMachines = machines.filter(
    (machine) => machine.estado === "dada_de_baja",
  );

  const inactiveMachines = machines.filter(
    (machine) => machine.estado === "inactiva",
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Mantenimiento de maquinaria · Máquinas
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Listado de máquinas
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta las máquinas y equipos críticos del taller, su estado
            operativo, ubicación, código interno y trazabilidad relacionada con
            fallas, etapas productivas y mantenimientos preventivos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/maintenance"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          {canManageMachines ? (
            <Link
              href="/dashboard/maintenance/machines/new"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Registrar máquina
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Máquinas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{machines.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total histórico de máquinas y equipos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operativas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {operationalMachines.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Inactivas: {inactiveMachines.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">En mantenimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {maintenanceMachines.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Requieren seguimiento técnico.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fuera de servicio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {outOfServiceMachines.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Equipos no disponibles para producción.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Máquinas registradas</CardTitle>
        </CardHeader>

        <CardContent>
          {machines.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Aún no hay máquinas registradas.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Registra la primera máquina para empezar a controlar fallas,
                reparaciones y mantenimientos preventivos.
              </p>

              {canManageMachines ? (
                <Link
                  href="/dashboard/maintenance/machines/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar primera máquina
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Máquina</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Ubicación</th>
                    <th className="py-2 pr-3">Código interno</th>
                    <th className="py-2 pr-3">Registro</th>
                    <th className="py-2 pr-3 text-right">Fallas</th>
                    <th className="py-2 pr-3 text-right">Preventivos</th>
                    <th className="py-2 pr-3 text-right">Etapas</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    {canManageMachines ? (
                      <th className="py-2 text-right">Cambiar estado</th>
                    ) : null}
                  </tr>
                </thead>

                <tbody>
                  {machines.map((machine) => (
                    <tr key={machine.id_maquina} className="border-b">
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

                      <td className="py-2 pr-3">
                        {machine.ubicacion ?? "-"}
                      </td>

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
                        <td className="py-2 text-right">
                          <form
                            action={updateMachineStatusAction}
                            className="flex justify-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="id_maquina"
                              value={machine.id_maquina}
                            />

                            <select
                              name="estado"
                              defaultValue={machine.estado}
                              className="rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                            >
                              <option value="operativa">Operativa</option>
                              <option value="en_reparacion">
                                En mantenimiento
                              </option>
                              <option value="dada_de_baja">
                                Fuera de servicio
                              </option>
                              <option value="inactiva">Inactiva</option>
                            </select>

                            <button
                              type="submit"
                              className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                            >
                              Guardar
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