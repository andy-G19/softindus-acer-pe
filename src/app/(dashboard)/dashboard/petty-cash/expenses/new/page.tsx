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
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { prisma } from "@/lib/db";
import { createPettyCashExpenseAction } from "@/modules/petty-cash/expenses/actions";

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

export default async function NewPettyCashExpensePage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  const [openBoxes, activeCategories, latestExpenses] = await Promise.all([
    prisma.caja_chica.findMany({
      where: {
        estado: "abierta",
      },
      orderBy: {
        nombre_caja: "asc",
      },
    }),

    prisma.categoria_gasto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_categoria: "asc",
      },
    }),

    prisma.movimiento_caja.findMany({
      where: {
        tipo_movimiento: "egreso",
      },
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 5,
      include: {
        caja_chica: true,
        categoria_gasto: true,
      },
    }),
  ]);

  const totalOpenBalance = openBoxes.reduce((total, box) => {
    return total + toNumber(box.saldo_actual);
  }, 0);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar egreso de caja chica"
        description="Registra gastos menores del taller, descuenta automáticamente el saldo de la caja seleccionada y conserva la trazabilidad del responsable, concepto, categoría, fecha y comprobante."
        backHref={navigationHrefs.pettyCash}
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
              <form action={createPettyCashExpenseAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="id_caja_chica">Caja chica</Label>
                  <NativeSelect id="id_caja_chica" name="id_caja_chica" required>
                    <option value="">Selecciona una caja</option>
                    {openBoxes.map((box) => (
                      <option key={box.id_caja_chica} value={box.id_caja_chica}>
                        {box.nombre_caja} · Saldo: {formatMoney(box.saldo_actual)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="id_categoria_gasto">Categoría de gasto</Label>
                  <NativeSelect id="id_categoria_gasto" name="id_categoria_gasto" required>
                    <option value="">Selecciona una categoría</option>
                    {activeCategories.map((category) => (
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
                  <Label htmlFor="concepto">Concepto</Label>
                  <Input
                    id="concepto"
                    name="concepto"
                    type="text"
                    required
                    placeholder="Ejemplo: Compra de discos de corte"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monto">Monto del egreso</Label>
                  <Input
                    id="monto"
                    name="monto"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="Ejemplo: 35.50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_movimiento">Fecha del egreso</Label>
                  <Input
                    id="fecha_movimiento"
                    name="fecha_movimiento"
                    type="date"
                    required
                    defaultValue={today}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comprobante">Comprobante</Label>
                  <Input
                    id="comprobante"
                    name="comprobante"
                    type="text"
                    placeholder="Ejemplo: Boleta B001-45"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsable">Responsable</Label>
                  <Input
                    id="responsable"
                    name="responsable"
                    type="text"
                    placeholder="Ejemplo: Administrador"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Detalle adicional del gasto."
                  />
                </div>

                <Button type="submit">Registrar egreso</Button>
              </form>
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
    </main>
  );
}
