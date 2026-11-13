import { FolderOpen, Landmark, Tags } from "lucide-react";
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
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { formatMoney } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import { createPettyCashExpenseAction } from "@/modules/petty-cash/expenses/actions";
import { PettyCashExpenseForm } from "@/modules/petty-cash/expenses/expense-form";
import { getNewPettyCashExpenseData } from "@/modules/petty-cash/expenses/queries";
import { pettyCashNotifications } from "@/modules/petty-cash/notifications";

type NewPettyCashExpensePageProps = {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

export default async function NewPettyCashExpensePage({ searchParams }: NewPettyCashExpensePageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  // C5 de la 11.4a (D46): al guardar o cancelar vuelve a la pagina de la que vino; sin ella, al
  // inicio de caja chica, como antes.
  const backHref = getSafeReturnTo((await searchParams)?.returnTo, navigationHrefs.pettyCash);

  const today = new Date().toISOString().split("T")[0];

  const { openBoxes, activeCategories, latestExpenses } =
    await getNewPettyCashExpenseData();

  const totalOpenBalance = openBoxes.reduce((total, box) => {
    return total + toNumber(box.saldo_actual);
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar egreso de caja chica"
        description="Registra gastos menores del taller, descuenta automáticamente el saldo de la caja seleccionada y conserva la trazabilidad del responsable, concepto, categoría, fecha y comprobante."
        backHref={backHref}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Registrar egreso" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Cajas abiertas" value={openBoxes.length.toString()} description="Disponibles para registrar egresos." tone="info" icon={FolderOpen} />
        <KpiCard title="Saldo disponible" value={formatMoney(totalOpenBalance)} description="Suma de saldos actuales de cajas abiertas." tone="info" icon={Landmark} />
        <KpiCard title="Categorías activas" value={activeCategories.length.toString()} description="Disponibles para clasificar gastos." tone="info" icon={Tags} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos del egreso</CardTitle>
          </CardHeader>

          <CardContent>
            {openBoxes.length === 0 ? (
              <EmptyState
                label="No hay cajas abiertas."
                description="Debes abrir una caja chica antes de registrar egresos."
                action={
                  <Button asChild>
                    <Link href="/dashboard/petty-cash/boxes/new">
                      Abrir caja chica
                    </Link>
                  </Button>
                }
              />
            ) : activeCategories.length === 0 ? (
              <EmptyState
                label="No hay categorías activas."
                description="Debes registrar al menos una categoría activa antes de registrar egresos."
                action={
                  <Button asChild>
                    <Link href="/dashboard/petty-cash/categories">
                      Crear categoría
                    </Link>
                  </Button>
                }
              />
            ) : (
              <PettyCashExpenseForm
                action={createPettyCashExpenseAction}
                boxes={openBoxes.map((box) => ({
                  id_caja_chica: box.id_caja_chica,
                  nombre_caja: box.nombre_caja,
                  saldo_actual: box.saldo_actual.toString(),
                }))}
                categories={activeCategories.map((category) => ({
                  id_categoria_gasto: category.id_categoria_gasto,
                  nombre_categoria: category.nombre_categoria,
                }))}
                defaultDate={today}
                successNotification={pettyCashNotifications["petty-cash-expense-registered"]}
                returnTo={backHref}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos egresos</CardTitle>
          </CardHeader>

          <CardContent>
            {latestExpenses.length === 0 ? (
              <EmptyState label="Aún no hay egresos registrados." />
            ) : (
              <div className="space-y-3">
                {latestExpenses.map((expense) => (
                  <div
                    key={expense.id_movimiento_caja}
                    className="rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {expense.concepto}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {expense.caja_chica.nombre_caja}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {expense.categoria_gasto?.nombre_categoria ?? "-"}
                        </p>
                      </div>

                      <Badge variant="destructive">
                        {formatMoney(expense.monto)}
                      </Badge>
                    </div>
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
