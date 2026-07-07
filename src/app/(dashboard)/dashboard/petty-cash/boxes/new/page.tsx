import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createPettyCashBoxAction } from "@/modules/petty-cash/boxes/actions";

export default async function NewPettyCashBoxPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="space-y-6">
      <PageHeader
        title="Abrir caja chica"
        description="Registra una nueva caja chica indicando nombre, saldo inicial, fecha de apertura, responsable y observaciones."
        backHref={navigationHrefs.pettyCashBoxes}
        backLabel="Volver a cajas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Cajas", href: navigationHrefs.pettyCashBoxes },
          { label: "Nueva caja" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos de apertura</CardTitle>
          </CardHeader>

          <CardContent>
            <form action={createPettyCashBoxAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre_caja">Nombre de la caja</Label>
                <Input
                  id="nombre_caja"
                  name="nombre_caja"
                  type="text"
                  required
                  placeholder="Ejemplo: Caja chica principal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="saldo_inicial">Saldo inicial</Label>
                <Input
                  id="saldo_inicial"
                  name="saldo_inicial"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="Ejemplo: 200.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_apertura">Fecha de apertura</Label>
                <Input
                  id="fecha_apertura"
                  name="fecha_apertura"
                  type="date"
                  required
                  defaultValue={today}
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
                  placeholder="Observaciones sobre la apertura de caja."
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit">Abrir caja chica</Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/petty-cash/boxes">Ver listado</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendación</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Usa una caja principal para los gastos menores diarios del
              taller.
            </p>

            <p>
              El saldo inicial será también el saldo actual al momento de
              crear la caja.
            </p>

            <p>
              Más adelante, los ingresos y egresos modificarán
              automáticamente el saldo actual.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
