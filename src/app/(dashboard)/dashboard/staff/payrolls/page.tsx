import { Ban, CheckCircle2, Clock, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
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
import { cancelPayrollAction } from "@/modules/staff/payrolls/actions";

type PayrollsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

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

function getPaymentModeLabel(mode: string) {
  const labels: Record<string, string> = {
    semanal: "Semanal",
    quincenal: "Quincenal",
    mensual: "Mensual",
  };

  return labels[mode] ?? mode;
}

function getPayrollStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    pagado: "Pagado",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

function getPayrollBadgeVariant(status: string) {
  if (status === "pagado") {
    return "success" as const;
  }

  if (status === "anulada") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export default async function PayrollsPage({ searchParams }: PayrollsPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const operario = parseStringParam(params, "operario");
  const periodo = parseStringParam(params, "periodo");
  const modalidad = parseStringParam(params, "modalidad");
  const estado = parseStringParam(params, "estado");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );

  const filters: Prisma.planilla_pagoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_planilla: { contains: q, mode: "insensitive" } },
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

  if (periodo) {
    const match = /^(\d{4})-(\d{2})$/.exec(periodo);

    if (match) {
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0);

      filters.push({
        periodo_inicio: { gte: start },
        periodo_fin: { lte: end },
      });
    }
  }

  if (modalidad) {
    filters.push({ modalidad_pago: modalidad });
  }

  if (estado) {
    filters.push({ estado_pago: estado });
  }

  if (dateRange) {
    filters.push({ fecha_generacion: dateRange });
  }

  const where: Prisma.planilla_pagoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [
    totalPayrolls,
    pendingPayrolls,
    paidPayrolls,
    canceledPayrolls,
    pendingNetAmount,
    latestPayrolls,
  ] = await Promise.all([
    prisma.planilla_pago.count({ where }),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "pendiente",
      },
    }),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "pagado",
      },
    }),

    prisma.planilla_pago.count({
      where: {
        estado_pago: "anulada",
      },
    }),

    prisma.planilla_pago.aggregate({
      where: {
        estado_pago: "pendiente",
      },
      _sum: {
        monto_neto: true,
      },
    }),

    prisma.planilla_pago.findMany({
      where,
      orderBy: [
        {
          fecha_generacion: "desc",
        },
        {
          id_planilla: "desc",
        },
      ],
      take: 50,
      include: {
        operario: true,
        usuario: true,
        _count: {
          select: {
            historial_pago_operario: true,
          },
        },
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Planillas de pago"
        description="Genera y consulta planillas de pago según operario, periodo, modalidad, tarifa configurada, asistencias válidas y descuentos."
        backHref={navigationHrefs.staff}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Planillas" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/staff/payrolls/new">Generar planilla</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Buscar planilla u operario" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operario">ID operario</Label>
              <Input id="operario" name="operario" defaultValue={operario} placeholder="ID operario" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodo">Periodo</Label>
              <Input id="periodo" name="periodo" type="month" defaultValue={periodo} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modalidad">Modalidad</Label>
              <NativeSelect id="modalidad" name="modalidad" defaultValue={modalidad}>
                <option value="">Todas las modalidades</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <NativeSelect id="estado" name="estado" defaultValue={estado}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
                <option value="anulada">Anulada</option>
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
            <div className="flex items-end gap-2 md:col-span-3 xl:col-span-7">
              <Button type="submit">Filtrar</Button>
              <Button variant="clear" asChild>
                <Link href="/dashboard/staff/payrolls">Limpiar filtros</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Planillas generadas" value={totalPayrolls.toString()} description="Total histórico registrado." tone="info" icon={FileSpreadsheet} />
        <KpiCard title="Pendientes" value={pendingPayrolls.toString()} description={`Por pagar: ${formatMoney(pendingNetAmount._sum.monto_neto)}`} tone={pendingPayrolls > 0 ? "warning" : "info"} icon={Clock} />
        <KpiCard title="Pagadas" value={paidPayrolls.toString()} description="Se marcarán en la siguiente subfase." tone="success" icon={CheckCircle2} />
        <KpiCard title="Anuladas" value={canceledPayrolls.toString()} description="Registros descartados." tone="info" icon={Ban} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimas planillas generadas
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {latestPayrolls.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Todavía no hay planillas generadas."
              description="Genera la primera planilla usando asistencias válidas del periodo seleccionado."
              action={
                <Button asChild>
                  <Link href="/dashboard/staff/payrolls/new">
                    Generar primera planilla
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Operario</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Descuentos</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  <TableHead>Generado por</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {latestPayrolls.map((payroll) => (
                  <TableRow key={payroll.id_planilla}>
                    <TableCell className="font-mono text-xs">
                      {payroll.id_planilla}
                    </TableCell>

                    <TableCell className="font-medium">
                      {payroll.operario.apellidos}, {payroll.operario.nombres}
                    </TableCell>

                    <TableCell>
                      {formatDate(payroll.periodo_inicio)} -{" "}
                      {formatDate(payroll.periodo_fin)}
                    </TableCell>

                    <TableCell>
                      {getPaymentModeLabel(payroll.modalidad_pago)}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatMoney(payroll.monto_bruto)}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatMoney(payroll.descuentos)}
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      {formatMoney(payroll.monto_neto)}
                    </TableCell>

                    <TableCell className="text-right">
                      <Badge variant={getPayrollBadgeVariant(payroll.estado_pago)}>
                        {getPayrollStatusLabel(payroll.estado_pago)}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {payroll.usuario.nombres} {payroll.usuario.apellidos}
                    </TableCell>

                    <TableCell className="text-right">
                      {payroll.estado_pago !== "pendiente" ||
                      payroll._count.historial_pago_operario > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Sin acción
                        </span>
                      ) : (
                        <form action={cancelPayrollAction}>
                          <input
                            type="hidden"
                            name="id_planilla"
                            value={payroll.id_planilla}
                          />

                          <ConfirmDeleteButton
                            title="¿Anular planilla?"
                            description="Esta acción anulará la planilla y no se puede deshacer. Verifique antes de continuar."
                            confirmText="Confirmar anulación"
                            entityName="planilla"
                          >
                            Anular
                          </ConfirmDeleteButton>
                        </form>
                      )}
                    </TableCell>
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
