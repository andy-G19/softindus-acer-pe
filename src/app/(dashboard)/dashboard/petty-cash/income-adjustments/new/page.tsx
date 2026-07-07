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
import { createPettyCashIncomeAdjustmentAction } from "@/modules/petty-cash/income-adjustments/actions";
import Link from "next/link";

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

export default async function NewPettyCashIncomeAdjustmentPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  const [openBoxes, latestMovements] = await Promise.all([
    prisma.caja_chica.findMany({
      where: {
        estado: "abierta",
      },
      orderBy: {
        nombre_caja: "asc",
      },
    }),

    prisma.movimiento_caja.findMany({
      where: {
        tipo_movimiento: {
          in: ["ingreso", "ajuste"],
        },
      },
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 6,
      include: {
        caja_chica: true,
      },
    }),
  ]);

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
    <main className="space-y-6">
      <PageHeader
        title="Registrar ingresos menores y ajustes"
        description="Registra ingresos menores del taller o ajustes de caja chica para corregir diferencias de saldo, manteniendo trazabilidad de fecha, responsable, concepto, monto y observaciones."
        backHref={navigationHrefs.pettyCash}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Ingresos y ajustes" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Cajas abiertas" value={openBoxes.length.toString()} description="Disponibles para ingresos y ajustes." tone="info" />
        <KpiCard title="Saldo disponible" value={formatMoney(totalOpenBalance)} description="Suma de cajas abiertas." tone="info" />
        <KpiCard title="Ajustes recientes" value={latestAdjustments.length.toString()} description="Dentro de los últimos movimientos consultados." tone="warning" />
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
              <form
                action={createPettyCashIncomeAdjustmentAction}
                className="space-y-4"
              >
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
                  <Label htmlFor="tipo_operacion">Tipo de operación</Label>
                  <NativeSelect
                    id="tipo_operacion"
                    name="tipo_operacion"
                    required
                    defaultValue="ingreso"
                  >
                    <option value="ingreso">
                      Ingreso menor — aumenta saldo
                    </option>
                    <option value="ajuste_incremento">
                      Ajuste positivo — aumenta saldo
                    </option>
                    <option value="ajuste_disminucion">
                      Ajuste negativo — disminuye saldo
                    </option>
                  </NativeSelect>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="concepto">Concepto</Label>
                  <Input
                    id="concepto"
                    name="concepto"
                    type="text"
                    required
                    placeholder="Ejemplo: Devolución de vuelto no usado"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monto">Monto</Label>
                  <Input
                    id="monto"
                    name="monto"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="Ejemplo: 20.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_movimiento">Fecha del movimiento</Label>
                  <Input
                    id="fecha_movimiento"
                    name="fecha_movimiento"
                    type="date"
                    required
                    defaultValue={today}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comprobante">Comprobante o referencia</Label>
                  <Input
                    id="comprobante"
                    name="comprobante"
                    type="text"
                    placeholder="Ejemplo: Ref. interna AJ-001"
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
                    placeholder="Detalle adicional del ingreso o ajuste."
                  />
                </div>

                <Button type="submit">Registrar movimiento</Button>
              </form>
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
                          {formatDate(movement.fecha_movimiento)}
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
    </main>
  );
}
