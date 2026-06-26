import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/db";

type PettyCashMovementsPageProps = {
  searchParams?: Promise<{
    caja?: string;
    tipo?: string;
    categoria?: string;
    desde?: string;
    hasta?: string;
    q?: string;
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
    return "destructive";
  }

  if (type === "ajuste") {
    return "secondary";
  }

  return "default";
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

  const [cashBoxes, categories, movements, totalMatches] = await Promise.all([
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
      take: 100,
      include: {
        caja_chica: true,
        categoria_gasto: true,
        usuario: true,
      },
    }),

    prisma.movimiento_caja.count({
      where,
    }),
  ]);

  const totalIncome = movements
    .filter((movement) => movement.tipo_movimiento === "ingreso")
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const totalExpenses = movements
    .filter((movement) => movement.tipo_movimiento === "egreso")
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const totalPositiveAdjustments = movements
    .filter((movement) => {
      return (
        movement.tipo_movimiento === "ajuste" &&
        movement.concepto.startsWith("Ajuste positivo")
      );
    })
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const totalNegativeAdjustments = movements
    .filter((movement) => {
      return (
        movement.tipo_movimiento === "ajuste" &&
        movement.concepto.startsWith("Ajuste negativo")
      );
    })
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const netResult =
    totalIncome +
    totalPositiveAdjustments -
    totalExpenses -
    totalNegativeAdjustments;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Caja chica y finanzas · Movimientos
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Listado de movimientos de caja
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta ingresos, egresos y ajustes de caja chica usando filtros
            por caja, tipo, categoría, fecha, concepto, comprobante o
            responsable.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/petty-cash"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Badge variant="secondary">Fase 7.6</Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimientos encontrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalMatches}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Se muestran hasta 100 registros.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingresos mostrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalIncome)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total de ingresos en la vista actual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Egresos mostrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalExpenses)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total de egresos en la vista actual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ajustes netos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalPositiveAdjustments - totalNegativeAdjustments)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajustes positivos menos negativos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado neto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(netResult)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresos y ajustes positivos menos egresos y ajustes negativos.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>

        <CardContent>
          <form method="GET" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="caja" className="text-sm font-medium">
                Caja chica
              </label>

              <select
                id="caja"
                name="caja"
                defaultValue={selectedCashBox}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">Todas las cajas</option>

                {cashBoxes.map((box) => (
                  <option key={box.id_caja_chica} value={box.id_caja_chica}>
                    {box.nombre_caja}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="tipo" className="text-sm font-medium">
                Tipo de movimiento
              </label>

              <select
                id="tipo"
                name="tipo"
                defaultValue={selectedType}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
                <option value="ajuste">Ajustes</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="categoria" className="text-sm font-medium">
                Categoría
              </label>

              <select
                id="categoria"
                name="categoria"
                defaultValue={selectedCategory}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">Todas las categorías</option>

                {categories.map((category) => (
                  <option
                    key={category.id_categoria_gasto}
                    value={category.id_categoria_gasto}
                  >
                    {category.nombre_categoria}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="desde" className="text-sm font-medium">
                Desde
              </label>

              <input
                id="desde"
                name="desde"
                type="date"
                defaultValue={selectedStartDate}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="hasta" className="text-sm font-medium">
                Hasta
              </label>

              <input
                id="hasta"
                name="hasta"
                type="date"
                defaultValue={selectedEndDate}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="q" className="text-sm font-medium">
                Buscar
              </label>

              <input
                id="q"
                name="q"
                type="text"
                defaultValue={searchText}
                placeholder="Concepto, comprobante, responsable..."
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="flex flex-col gap-2 md:flex-row lg:col-span-3">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Aplicar filtros
              </button>

              <Link
                href="/dashboard/petty-cash/movements"
                className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
              >
                Limpiar filtros
              </Link>
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

        <CardContent>
          {movements.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                No se encontraron movimientos.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Ajusta los filtros o registra nuevos ingresos, egresos o ajustes
                de caja chica.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Concepto</th>
                    <th className="py-2 pr-3">Caja</th>
                    <th className="py-2 pr-3">Categoría</th>
                    <th className="py-2 pr-3">Responsable</th>
                    <th className="py-2 pr-3">Comprobante</th>
                    <th className="py-2 pr-3">Registrado por</th>
                    <th className="py-2 text-right">Monto</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((movement) => (
                    <tr
                      key={movement.id_movimiento_caja}
                      className="border-b align-top"
                    >
                      <td className="py-2 pr-3">
                        {formatDate(movement.fecha_movimiento)}
                      </td>

                      <td className="py-2 pr-3">
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
                      </td>

                      <td className="py-2 pr-3">
                        <p className="font-medium">{movement.concepto}</p>

                        {movement.observaciones ? (
                          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                            {movement.observaciones}
                          </p>
                        ) : null}
                      </td>

                      <td className="py-2 pr-3">
                        {movement.caja_chica.nombre_caja}
                      </td>

                      <td className="py-2 pr-3">
                        {movement.categoria_gasto?.nombre_categoria ?? "-"}
                      </td>

                      <td className="py-2 pr-3">
                        {movement.responsable ?? "-"}
                      </td>

                      <td className="py-2 pr-3">
                        {movement.comprobante ?? "-"}
                      </td>

                      <td className="py-2 pr-3">
                        {movement.usuario.nombres} {movement.usuario.apellidos}
                      </td>

                      <td className="py-2 text-right font-medium">
                        {formatSignedMoney(
                          movement.tipo_movimiento,
                          movement.concepto,
                          movement.monto,
                        )}
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