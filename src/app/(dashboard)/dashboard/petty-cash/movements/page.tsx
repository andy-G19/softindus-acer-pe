import { ClipboardList, Scale, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { PaginationControls } from "@/components/pagination-controls";
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
import { APP_ROLES } from "@/lib/permissions";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { getPaginationMeta, getPaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/db";
import { annulPettyCashMovementAction } from "@/modules/petty-cash/movements/actions";

type PettyCashMovementsPageProps = {
  searchParams?: Promise<{
    caja?: string;
    tipo?: string;
    categoria?: string;
    desde?: string;
    hasta?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
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

function normalizeParam(value: string | undefined) {
  return value?.trim() ?? "";
}

function getMovementLabel(type: string, concept: string) {
  if (type === "ingreso") {
    return "Ingreso";
  }

  if (type === "egreso") {
    return "Egreso";
  }

  if (concept.startsWith("Ajuste positivo")) {
    return "Ajuste positivo";
  }

  if (concept.startsWith("Ajuste negativo")) {
    return "Ajuste negativo";
  }

  return "Ajuste";
}

function getMovementBadgeVariant(type: string, concept: string) {
  if (type === "egreso" || concept.startsWith("Ajuste negativo")) {
    return "destructive" as const;
  }

  if (type === "ajuste") {
    return "secondary" as const;
  }

  return "success" as const;
}

function isNegativeMovement(type: string, concept: string) {
  return type === "egreso" || concept.startsWith("Ajuste negativo");
}

function formatSignedMoney(type: string, concept: string, amount: unknown) {
  const sign = isNegativeMovement(type, concept) ? "-" : "+";

  return `${sign} ${formatMoney(amount)}`;
}

export default async function PettyCashMovementsPage({
  searchParams,
}: PettyCashMovementsPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};

  const selectedCashBox = normalizeParam(params.caja);
  const selectedType = normalizeParam(params.tipo);
  const selectedCategory = normalizeParam(params.categoria);
  const selectedStartDate = normalizeParam(params.desde);
  const selectedEndDate = normalizeParam(params.hasta);
  const searchText = normalizeParam(params.q);

  const where: Prisma.movimiento_cajaWhereInput = {};

  if (selectedCashBox) {
    where.id_caja_chica = selectedCashBox;
  }

  if (selectedType) {
    where.tipo_movimiento = selectedType;
  }

  if (selectedCategory) {
    where.id_categoria_gasto = selectedCategory;
  }

  if (selectedStartDate || selectedEndDate) {
    where.fecha_movimiento = {
      ...(selectedStartDate
        ? {
            gte: new Date(`${selectedStartDate}T00:00:00`),
          }
        : {}),
      ...(selectedEndDate
        ? {
            lte: new Date(`${selectedEndDate}T23:59:59`),
          }
        : {}),
    };
  }

  if (searchText) {
    where.OR = [
      {
        concepto: {
          contains: searchText,
          mode: "insensitive",
        },
      },
      {
        comprobante: {
          contains: searchText,
          mode: "insensitive",
        },
      },
      {
        responsable: {
          contains: searchText,
          mode: "insensitive",
        },
      },
      {
        observaciones: {
          contains: searchText,
          mode: "insensitive",
        },
      },
    ];
  }

  const { page, pageSize, skip, take } = getPaginationParams(params);

  const [
    cashBoxes,
    categories,
    movements,
    totalMatches,
    incomeSum,
    expenseSum,
    positiveAdjustmentSum,
    negativeAdjustmentSum,
  ] = await Promise.all([
    prisma.caja_chica.findMany({
      orderBy: {
        nombre_caja: "asc",
      },
    }),

    prisma.categoria_gasto.findMany({
      orderBy: {
        nombre_categoria: "asc",
      },
    }),

    prisma.movimiento_caja.findMany({
      where,
      orderBy: [
        {
          fecha_movimiento: "desc",
        },
        {
          id_movimiento_caja: "desc",
        },
      ],
      skip,
      take,
      include: {
        caja_chica: true,
        categoria_gasto: true,
        usuario: true,
      },
    }),

    prisma.movimiento_caja.count({
      where,
    }),

    // Los totales de las KPI se calculan con aggregate sobre TODO el
    // conjunto filtrado (no solo la pagina actual), para que sigan siendo
    // correctos ahora que la tabla esta paginada.
    prisma.movimiento_caja.aggregate({
      where: { AND: [where, { tipo_movimiento: "ingreso" }] },
      _sum: { monto: true },
    }),
    prisma.movimiento_caja.aggregate({
      where: { AND: [where, { tipo_movimiento: "egreso" }] },
      _sum: { monto: true },
    }),
    prisma.movimiento_caja.aggregate({
      where: {
        AND: [
          where,
          { tipo_movimiento: "ajuste" },
          { concepto: { startsWith: "Ajuste positivo" } },
        ],
      },
      _sum: { monto: true },
    }),
    prisma.movimiento_caja.aggregate({
      where: {
        AND: [
          where,
          { tipo_movimiento: "ajuste" },
          { concepto: { startsWith: "Ajuste negativo" } },
        ],
      },
      _sum: { monto: true },
    }),
  ]);

  const meta = getPaginationMeta({ totalItems: totalMatches, page, pageSize });

  const totalIncome = toNumber(incomeSum._sum.monto);
  const totalExpenses = toNumber(expenseSum._sum.monto);
  const totalPositiveAdjustments = toNumber(positiveAdjustmentSum._sum.monto);
  const totalNegativeAdjustments = toNumber(negativeAdjustmentSum._sum.monto);

  const netResult =
    totalIncome +
    totalPositiveAdjustments -
    totalExpenses -
    totalNegativeAdjustments;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Listado de movimientos de caja"
        description="Consulta ingresos, egresos y ajustes de caja chica usando filtros por caja, tipo, categoría, fecha, concepto, comprobante o responsable."
        backHref={navigationHrefs.pettyCash}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Movimientos" },
        ])}
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Movimientos encontrados" value={totalMatches.toString()} description="Total según filtros aplicados." tone="info" icon={ClipboardList} />
        <KpiCard title="Ingresos mostrados" value={formatMoney(totalIncome)} description="Total de ingresos según filtros aplicados." tone="success" icon={TrendingUp} />
        <KpiCard title="Egresos mostrados" value={formatMoney(totalExpenses)} description="Total de egresos según filtros aplicados." tone="warning" icon={TrendingDown} />
        <KpiCard title="Ajustes netos" value={formatMoney(totalPositiveAdjustments - totalNegativeAdjustments)} description="Ajustes positivos menos negativos." tone="info" icon={Scale} />
        <KpiCard title="Resultado neto" value={formatMoney(netResult)} description="Ingresos y ajustes positivos menos egresos y ajustes negativos." tone="info" icon={Scale} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>

        <CardContent>
          <form method="GET" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="caja">Caja chica</Label>
              <NativeSelect id="caja" name="caja" defaultValue={selectedCashBox}>
                <option value="">Todas las cajas</option>
                {cashBoxes.map((box) => (
                  <option key={box.id_caja_chica} value={box.id_caja_chica}>
                    {box.nombre_caja}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de movimiento</Label>
              <NativeSelect id="tipo" name="tipo" defaultValue={selectedType}>
                <option value="">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
                <option value="ajuste">Ajustes</option>
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <NativeSelect id="categoria" name="categoria" defaultValue={selectedCategory}>
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option
                    key={category.id_categoria_gasto}
                    value={category.id_categoria_gasto}
                  >
                    {category.nombre_categoria}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" name="desde" type="date" defaultValue={selectedStartDate} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" name="hasta" type="date" defaultValue={selectedEndDate} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                name="q"
                type="text"
                defaultValue={searchText}
                placeholder="Concepto, comprobante, responsable..."
              />
            </div>

            <div className="flex flex-col gap-2 md:flex-row lg:col-span-3">
              <Button type="submit">Aplicar filtros</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/petty-cash/movements">
                  Limpiar filtros
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Movimientos registrados
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {movements.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron movimientos."
              description="Ajusta los filtros o registra nuevos ingresos, egresos o ajustes de caja chica."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id_movimiento_caja} className="align-top">
                    <TableCell>{formatDate(movement.fecha_movimiento)}</TableCell>

                    <TableCell>
                      <Badge
                        variant={getMovementBadgeVariant(
                          movement.tipo_movimiento,
                          movement.concepto,
                        )}
                      >
                        {getMovementLabel(
                          movement.tipo_movimiento,
                          movement.concepto,
                        )}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <p className="font-medium">{movement.concepto}</p>
                      {movement.observaciones ? (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                          {movement.observaciones}
                        </p>
                      ) : null}
                    </TableCell>

                    <TableCell>{movement.caja_chica.nombre_caja}</TableCell>

                    <TableCell>
                      {movement.categoria_gasto?.nombre_categoria ?? "-"}
                    </TableCell>

                    <TableCell>{movement.responsable ?? "-"}</TableCell>

                    <TableCell>{movement.comprobante ?? "-"}</TableCell>

                    <TableCell>
                      {movement.usuario.nombres} {movement.usuario.apellidos}
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      {formatSignedMoney(
                        movement.tipo_movimiento,
                        movement.concepto,
                        movement.monto,
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {movement.observaciones?.includes("[ANULADO]") ? (
                        <span className="text-xs text-muted-foreground">
                          Anulado
                        </span>
                      ) : (
                        <form action={annulPettyCashMovementAction}>
                          <input
                            type="hidden"
                            name="id_movimiento_caja"
                            value={movement.id_movimiento_caja}
                          />
                          <ConfirmDeleteButton
                            title="¿Anular movimiento de caja?"
                            description="Esta acción anulará el movimiento de caja chica y no se puede deshacer."
                            confirmText="Confirmar anulación"
                            entityName="movimiento"
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

      <PaginationControls
        meta={meta}
        basePath={navigationHrefs.pettyCashMovements}
        searchParams={params as Record<string, string | string[] | undefined>}
        itemLabel="movimientos"
      />
    </main>
  );
}
