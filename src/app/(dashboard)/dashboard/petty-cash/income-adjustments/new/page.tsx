import { FolderOpen, Landmark, Scale } from "lucide-react";

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
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { formatDate, formatMoney } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import { createPettyCashIncomeAdjustmentAction } from "@/modules/petty-cash/income-adjustments/actions";
import { PettyCashIncomeAdjustmentForm } from "@/modules/petty-cash/income-adjustments/income-adjustment-form";
import { getNewPettyCashIncomeAdjustmentData } from "@/modules/petty-cash/income-adjustments/queries";
import { pettyCashNotifications } from "@/modules/petty-cash/notifications";
import Link from "next/link";

function getMovementLabel(type: string, concept: string) {
  if (type === "ingreso") {
    return "Ingreso";
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
  if (type === "ingreso" || concept.startsWith("Ajuste positivo")) {
    return "success" as const;
  }

  return "secondary" as const;
}

type NewPettyCashIncomeAdjustmentPageProps = {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

export default async function NewPettyCashIncomeAdjustmentPage({
  searchParams,
}: NewPettyCashIncomeAdjustmentPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  // C6 de la 11.4a (D46): al guardar o cancelar vuelve a la pagina de la que vino; sin ella, al
  // inicio de caja chica, como antes.
  const backHref = getSafeReturnTo((await searchParams)?.returnTo, navigationHrefs.pettyCash);

  const today = new Date().toISOString().split("T")[0];

  const { openBoxes, latestMovements } =
    await getNewPettyCashIncomeAdjustmentData();

  const totalOpenBalance = openBoxes.reduce((total, box) => {
    return total + toNumber(box.saldo_actual);
  }, 0);

  const totalLatestIncome = latestMovements
    .filter((movement) => movement.tipo_movimiento === "ingreso")
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const latestAdjustments = latestMovements.filter((movement) => {
    return movement.tipo_movimiento === "ajuste";
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar ingresos menores y ajustes"
        description="Registra ingresos menores del taller o ajustes de caja chica para corregir diferencias de saldo, manteniendo trazabilidad de fecha, responsable, concepto, monto y observaciones."
        backHref={backHref}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Ingresos y ajustes" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Cajas abiertas" value={openBoxes.length.toString()} description="Disponibles para ingresos y ajustes." tone="info" icon={FolderOpen} />
        <KpiCard title="Saldo disponible" value={formatMoney(totalOpenBalance)} description="Suma de cajas abiertas." tone="info" icon={Landmark} />
        <KpiCard title="Ajustes recientes" value={latestAdjustments.length.toString()} description="Dentro de los últimos movimientos consultados." tone="warning" icon={Scale} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos del ingreso o ajuste
            </CardTitle>
          </CardHeader>

          <CardContent>
            {openBoxes.length === 0 ? (
              <EmptyState
                label="No hay cajas abiertas."
                description="Debes abrir una caja chica antes de registrar ingresos o ajustes."
                action={
                  <Button asChild>
                    <Link href="/dashboard/petty-cash/boxes/new">
                      Abrir caja chica
                    </Link>
                  </Button>
                }
              />
            ) : (
              <PettyCashIncomeAdjustmentForm
                action={createPettyCashIncomeAdjustmentAction}
                boxes={openBoxes.map((box) => ({
                  id_caja_chica: box.id_caja_chica,
                  nombre_caja: box.nombre_caja,
                  saldo_actual: box.saldo_actual.toString(),
                }))}
                defaultDate={today}
                successNotification={pettyCashNotifications["petty-cash-income-registered"]}
                returnTo={backHref}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Últimos ingresos y ajustes
            </CardTitle>
          </CardHeader>

          <CardContent>
            {latestMovements.length === 0 ? (
              <EmptyState label="Aún no hay ingresos ni ajustes registrados." />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Ingresos recientes consultados
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {formatMoney(totalLatestIncome)}
                  </p>
                </div>

                {latestMovements.map((movement) => (
                  <div
                    key={movement.id_movimiento_caja}
                    className="rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {movement.concepto}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {movement.caja_chica.nombre_caja}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(movement.fecha_movimiento, { format: "dd/mm/yyyy" })}
                        </p>
                      </div>

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
                    </div>

                    <p className="mt-2 text-sm font-medium text-foreground">
                      {formatMoney(movement.monto)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
