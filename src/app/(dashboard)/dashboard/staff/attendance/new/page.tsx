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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createAttendanceAction } from "@/modules/staff/attendance/actions";

export default async function NewAttendancePage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const today = new Date().toISOString().split("T")[0];

  const operators = await prisma.operario.findMany({
    where: {
      estado: "activo",
    },
    orderBy: [
      {
        apellidos: "asc",
      },
      {
        nombres: "asc",
      },
    ],
  });

  const operatorItems = operators.map((operator) => ({
    id: operator.id_operario,
    label: `${operator.apellidos}, ${operator.nombres}`,
    description: operator.cargo ?? "Sin cargo",
  }));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar asistencia diaria"
        description="Registra la asistencia de un operario indicando fecha, hora de ingreso, hora de salida, tardanza, falta y observaciones."
        backHref={navigationHrefs.attendance}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Asistencia", href: navigationHrefs.attendance },
          { label: "Nueva asistencia" },
        ])}
        actions={<Badge>ADMIN / Maestro de taller</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos de asistencia
            </CardTitle>
          </CardHeader>

          <CardContent>
            {operators.length === 0 ? (
              <EmptyState
                label="No hay operarios activos disponibles."
                description="Primero registra o activa operarios para poder controlar su asistencia."
                action={
                  <Button asChild>
                    <Link href="/dashboard/staff/operators">Ir a operarios</Link>
                  </Button>
                }
              />
            ) : (
              <form action={createAttendanceAction} className="space-y-4">
                <div className="space-y-2">
                  <SearchableSelect
                    name="id_operario"
                    label="Operario"
                    placeholder="Buscar operario..."
                    items={operatorItems}
                    required
                    emptyMessage="No hay operarios activos disponibles."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="fecha">Fecha</Label>
                    <Input
                      id="fecha"
                      name="fecha"
                      type="date"
                      required
                      defaultValue={today}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hora_ingreso">Hora de ingreso</Label>
                    <Input id="hora_ingreso" name="hora_ingreso" type="time" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hora_salida">Hora de salida</Label>
                    <Input id="hora_salida" name="hora_salida" type="time" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm">
                    <input
                      name="tardanza"
                      type="checkbox"
                      className="mt-1"
                    />

                    <span>
                      <span className="block font-medium">
                        Marcar tardanza
                      </span>
                      <span className="text-muted-foreground">
                        Úsalo cuando el operario ingresó fuera del horario
                        esperado.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm">
                    <input name="falta" type="checkbox" className="mt-1" />

                    <span>
                      <span className="block font-medium">
                        Marcar falta
                      </span>
                      <span className="text-muted-foreground">
                        Si marcas falta, deja vacías las horas de ingreso y
                        salida.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Ejemplo: Llegó tarde por transporte, permiso, salida anticipada, etc."
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit">Registrar asistencia</Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/staff/attendance">Ver listado</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reglas de uso</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Cada operario solo puede tener un registro de asistencia por día.
            </p>

            <p>
              Si registras ingreso y salida, el sistema calculará las horas
              trabajadas automáticamente.
            </p>

            <p>
              Si marcas falta, no debes registrar horas de ingreso ni de salida.
            </p>

            <p>
              Este registro servirá más adelante para la generación de planillas.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
