import Link from "next/link";
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

function getBoxStatusLabel(status: string) {
  const labels: Record<string, string> = {
    abierta: "Abierta",
    cerrada: "Cerrada",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

export default async function PettyCashBoxesPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const boxes = await prisma.caja_chica.findMany({
    orderBy: [
      {
        estado: "asc",
      },
      {
        fecha_apertura: "desc",
      },
    ],
    include: {
      _count: {
        select: {
          movimiento_caja: true,
        },
      },
    },
  });

  const openBoxes = boxes.filter((box) => box.estado === "abierta");
  const closedBoxes = boxes.filter((box) => box.estado === "cerrada");

  const totalInitialBalance = boxes.reduce((total, box) => {
    return total + toNumber(box.saldo_inicial);
  }, 0);

  const totalCurrentBalance = openBoxes.reduce((total, box) => {
    return total + toNumber(box.saldo_actual);
  }, 0);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Caja chica y finanzas · Cajas chicas
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Listado de cajas chicas
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta las cajas chicas abiertas y cerradas, sus saldos,
            responsables, fechas de apertura y cantidad de movimientos
            registrados.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/petty-cash"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Link
            href="/dashboard/petty-cash/boxes/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Abrir caja
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cajas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{boxes.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total histórico de cajas chicas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cajas abiertas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openBoxes.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cajas disponibles para nuevos movimientos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cajas cerradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{closedBoxes.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cajas que ya no deberían recibir movimientos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo abierto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalCurrentBalance)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Suma actual de cajas abiertas.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cajas chicas registradas
          </CardTitle>
        </CardHeader>

        <CardContent>
          {boxes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Aún no hay cajas chicas registradas.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Abre una caja chica para empezar a registrar movimientos
                financieros menores.
              </p>

              <Link
                href="/dashboard/petty-cash/boxes/new"
                className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Abrir primera caja
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Caja</th>
                    <th className="py-2 pr-3">Responsable</th>
                    <th className="py-2 pr-3">Apertura</th>
                    <th className="py-2 pr-3 text-right">Saldo inicial</th>
                    <th className="py-2 pr-3 text-right">Saldo actual</th>
                    <th className="py-2 pr-3 text-right">Movimientos</th>
                    <th className="py-2 text-right">Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {boxes.map((box) => (
                    <tr key={box.id_caja_chica} className="border-b">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {box.id_caja_chica}
                      </td>

                      <td className="py-2 pr-3 font-medium">
                        {box.nombre_caja}
                      </td>

                      <td className="py-2 pr-3">
                        {box.responsable ?? "-"}
                      </td>

                      <td className="py-2 pr-3">
                        {formatDate(box.fecha_apertura)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatMoney(box.saldo_inicial)}
                      </td>

                      <td className="py-2 pr-3 text-right font-medium">
                        {formatMoney(box.saldo_actual)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {box._count.movimiento_caja}
                      </td>

                      <td className="py-2 text-right">
                        <Badge
                          variant={
                            box.estado === "abierta"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {getBoxStatusLabel(box.estado)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="border-t font-medium">
                    <td className="py-3 pr-3" colSpan={4}>
                      Totales
                    </td>

                    <td className="py-3 pr-3 text-right">
                      {formatMoney(totalInitialBalance)}
                    </td>

                    <td className="py-3 pr-3 text-right">
                      {formatMoney(totalCurrentBalance)}
                    </td>

                    <td className="py-3 pr-3 text-right">
                      {boxes.reduce((total, box) => {
                        return total + box._count.movimiento_caja;
                      }, 0)}
                    </td>

                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}