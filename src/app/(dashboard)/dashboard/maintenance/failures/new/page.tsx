import Link from "next/link";

import { SearchableSelect } from "@/components/forms/searchable-select";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createFailureAction } from "@/modules/maintenance/failures/actions";

function getCurrentDateTimeValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 16);
}

function getMachineStatusLabel(status: string) {
  const labels: Record<string, string> = {
    operativa: "Operativa",
    en_reparacion: "En mantenimiento",
    inactiva: "Inactiva",
    dada_de_baja: "Fuera de servicio",
  };

  return labels[status] ?? status;
}

export default async function NewFailurePage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const machines = await prisma.maquina.findMany({
    orderBy: [
      {
        estado: "asc",
      },
      {
        nombre: "asc",
      },
    ],
  });

  const currentDateTime = getCurrentDateTimeValue();
  const machineItems = machines.map((machine) => ({
    id: machine.id_maquina,
    label: machine.nombre,
    description: `${machine.tipo} - ${getMachineStatusLabel(machine.estado)}`,
  }));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar falla de maquinaria"
        description="Documenta una falla tecnica de una maquina o equipo critico, registrando fecha, descripcion, responsable, tiempo perdido e impacto en produccion."
        backHref={navigationHrefs.failures}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Fallas", href: navigationHrefs.failures },
          { label: "Nueva falla" },
        ])}
        actions={<Badge>ADMIN / Maestro de taller</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos de la falla</CardTitle>
          </CardHeader>

          <CardContent>
            {machines.length === 0 ? (
              <EmptyState
                label="No hay maquinas registradas."
                description="Primero registra una maquina para poder documentar sus fallas."
                action={
                  <Button asChild>
                    <Link href="/dashboard/maintenance/machines/new">
                      Registrar maquina
                    </Link>
                  </Button>
                }
              />
            ) : (
              <form action={createFailureAction} className="space-y-4">
                <div className="space-y-2">
                  <SearchableSelect
                    name="id_maquina"
                    label="Maquina"
                    placeholder="Buscar maquina..."
                    items={machineItems}
                    required
                    emptyMessage="No hay maquinas registradas."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fecha_falla">Fecha y hora de falla</Label>
                    <Input
                      id="fecha_falla"
                      name="fecha_falla"
                      type="datetime-local"
                      required
                      defaultValue={currentDateTime}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado_atencion">Estado de atencion</Label>
                    <NativeSelect
                      id="estado_atencion"
                      name="estado_atencion"
                      required
                      defaultValue="pendiente"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_atencion">En atencion</option>
                      <option value="reparada">Reparada</option>
                      <option value="anulada">Anulada</option>
                    </NativeSelect>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripcion de la falla</Label>
                  <Textarea
                    id="descripcion"
                    name="descripcion"
                    rows={4}
                    required
                    placeholder="Ejemplo: La prensa hidraulica perdio presion durante el proceso de doblado."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="responsable_registro">
                      Responsable del registro
                    </Label>
                    <Input
                      id="responsable_registro"
                      name="responsable_registro"
                      type="text"
                      placeholder="Ejemplo: Maestro de taller"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tiempo_perdido_horas">
                      Tiempo perdido en horas
                    </Label>
                    <Input
                      id="tiempo_perdido_horas"
                      name="tiempo_perdido_horas"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ejemplo: 2.50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="impacto_produccion">
                    Impacto en produccion
                  </Label>
                  <Textarea
                    id="impacto_produccion"
                    name="impacto_produccion"
                    rows={3}
                    placeholder="Ejemplo: Se detuvo el doblado de piezas durante la tarde."
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit">Registrar falla</Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/maintenance/failures">
                      Ver listado
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/maintenance">Volver al modulo</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendacion</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Registra la falla apenas ocurra para no perder trazabilidad del
              tiempo detenido y del impacto en produccion.
            </p>

            <p>
              Si la falla todavia no fue revisada, usa el estado{" "}
              <strong>Pendiente</strong>. Si ya esta siendo atendida, usa{" "}
              <strong>En atencion</strong>.
            </p>

            <p>
              La reparacion y el costo economico se registraran en la siguiente
              subfase, cuando implementemos reparaciones y repuestos.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
