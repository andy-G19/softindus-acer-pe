import { Archive, FolderOpen, Landmark, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
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
      <PageHeader
        title="Cajas chicas"
        description="Consulta las cajas chicas abiertas y cerradas, sus saldos, responsables, fechas de apertura y cantidad de movimientos registrados."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Cajas" },
        ])}
        actions={
          <Button asChild>
            <Link href={`${navigationHrefs.pettyCashBoxes}/new`}>
              Abrir caja
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Cajas registradas" value={boxes.length.toString()} description="Total histórico de cajas chicas." tone="info" icon={Archive} />
        <KpiCard title="Cajas abiertas" value={openBoxes.length.toString()} description="Cajas disponibles para nuevos movimientos." tone="success" icon={FolderOpen} />
        <KpiCard title="Cajas cerradas" value={closedBoxes.length.toString()} description="Cajas que ya no deberían recibir movimientos." tone="info" icon={XCircle} />
        <KpiCard title="Saldo abierto" value={formatMoney(totalCurrentBalance)} description="Suma actual de cajas abiertas." tone="info" icon={Landmark} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cajas chicas registradas
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {boxes.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Aún no hay cajas chicas registradas."
              description="Abre una caja chica para empezar a registrar movimientos financieros menores."
              action={
                <Button asChild>
                  <Link href="/dashboard/petty-cash/boxes/new">
                    Abrir primera caja
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead className="text-right">Saldo inicial</TableHead>
                  <TableHead className="text-right">Saldo actual</TableHead>
                  <TableHead className="text-right">Movimientos</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {boxes.map((box) => (
                  <TableRow key={box.id_caja_chica}>
                    <TableCell className="text-xs">
                      {box.id_caja_chica}
                    </TableCell>

                    <TableCell className="font-medium">
                      {box.nombre_caja}
                    </TableCell>

                    <TableCell>{box.responsable ?? "-"}</TableCell>

                    <TableCell>{formatDate(box.fecha_apertura)}</TableCell>

                    <TableCell className="text-right">
                      {formatMoney(box.saldo_inicial)}
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      {formatMoney(box.saldo_actual)}
                    </TableCell>

                    <TableCell className="text-right">
                      {box._count.movimiento_caja}
                    </TableCell>

                    <TableCell className="text-right">
                      <Badge
                        variant={
                          box.estado === "abierta" ? "success" : "secondary"
                        }
                      >
                        {getBoxStatusLabel(box.estado)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>

              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Totales</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(totalInitialBalance)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(totalCurrentBalance)}
                  </TableCell>
                  <TableCell className="text-right">
                    {boxes.reduce((total, box) => {
                      return total + box._count.movimiento_caja;
                    }, 0)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
