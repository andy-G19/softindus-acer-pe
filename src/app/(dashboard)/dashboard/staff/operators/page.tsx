import { CheckCircle2, Users, XCircle } from "lucide-react";
import Link from "next/link";

import {
  RowEditLink,
  RowToggleStatusButton,
} from "@/components/table/row-actions";
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
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
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
      <PageHeader
        title="Operarios"
        description="Consulta operarios del taller, modalidad de pago y trazabilidad relacionada con asistencia, tareas y planillas."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Operarios" },
        ])}
        actions={
          canManageOperators ? (
            <Button asChild>
              <Link href={`${navigationHrefs.operators}/new`}>
                Registrar operario
              </Link>
            </Button>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Operarios registrados" value={operators.length.toString()} description="Total de operarios en el sistema." tone="info" icon={Users} />
        <KpiCard title="Activos" value={activeOperators.length.toString()} description="Disponibles para asignación." tone="success" icon={CheckCircle2} />
        <KpiCard title="Inactivos" value={inactiveOperators.length.toString()} description="Retirados o suspendidos." tone="warning" icon={XCircle} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action="/dashboard/staff/operators"
            className="grid gap-3 md:grid-cols-6"
          >
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Buscar operario..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <NativeSelect id="cargo" name="cargo" defaultValue={cargo}>
                <option value="">Todos los cargos</option>
                {cargos.map((item) =>
                  item.cargo ? (
                    <option key={item.cargo} value={item.cargo}>
                      {item.cargo}
                    </option>
                  ) : null,
                )}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="especialidad">Especialidad</Label>
              <NativeSelect
                id="especialidad"
                name="especialidad"
                defaultValue={especialidad}
              >
                <option value="">Especialidad</option>
                {especialidades.map((item) =>
                  item.especialidad ? (
                    <option key={item.especialidad} value={item.especialidad}>
                      {item.especialidad}
                    </option>
                  ) : null,
                )}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modalidad">Modalidad</Label>
              <NativeSelect id="modalidad" name="modalidad" defaultValue={modalidad}>
                <option value="">Modalidad</option>
                {modalidades.map((item) => (
                  <option key={item.modalidad_pago} value={item.modalidad_pago}>
                    {item.modalidad_pago}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <NativeSelect id="status" name="status" defaultValue={status}>
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </NativeSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">
                Filtrar
              </Button>
              <Button variant="clear" asChild>
                <Link href="/dashboard/staff/operators">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operarios registrados</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {operators.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Todavía no hay operarios registrados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Operario</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Asist.</TableHead>
                  <TableHead className="text-right">Tareas</TableHead>
                  <TableHead className="text-right">Planillas</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  {canManageOperators ? (
                    <TableHead className="text-right">Acciones</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((operator) => (
                  <TableRow key={operator.id_operario} className="align-top">
                    <TableCell className="font-mono text-xs">
                      {operator.id_operario}
                    </TableCell>
                    <TableCell className="font-medium">
                      {operator.apellidos}, {operator.nombres}
                      <p className="text-xs font-normal text-muted-foreground">
                        {operator.telefono ?? "Sin telefono"}
                      </p>
                    </TableCell>
                    <TableCell>{operator.cargo ?? "-"}</TableCell>
                    <TableCell>{operator.especialidad ?? "-"}</TableCell>
                    <TableCell>{operator.modalidad_pago}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(operator.tarifa)}
                    </TableCell>
                    <TableCell className="text-right">
                      {operator._count.asistencia}
                    </TableCell>
                    <TableCell className="text-right">
                      {operator._count.tarea_operario}
                    </TableCell>
                    <TableCell className="text-right">
                      {operator._count.planilla_pago}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          operator.estado === "activo" ? "success" : "secondary"
                        }
                      >
                        {getStatusLabel(operator.estado)}
                      </Badge>
                    </TableCell>
                    {canManageOperators ? (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <RowEditLink
                            href={`/dashboard/staff/operators/${operator.id_operario}/edit`}
                          />
                          <RowToggleStatusButton
                            action={toggleOperatorStatusAction}
                            hiddenFieldName="id_operario"
                            hiddenFieldValue={operator.id_operario}
                            isActive={operator.estado === "activo"}
                          />
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

