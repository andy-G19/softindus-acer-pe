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
import { createPreventiveMaintenanceAction } from "@/modules/maintenance/preventive/actions";

function getTodayValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 10);
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

export default async function NewPreventiveMaintenancePage() {
  await requireRole([APP_ROLES.ADMIN]);

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

  const today = getTodayValue();
  const machineItems = machines.map((machine) => ({
    id: machine.id_maquina,
    label: machine.nombre,
    description: `${machine.tipo} - ${getMachineStatusLabel(machine.estado)}`,
  }));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Programar mantenimiento preventivo"
        description="Programa actividades preventivas por maquina para anticipar fallas, reducir paradas imprevistas y mantener la continuidad del taller."
        backHref={navigationHrefs.preventiveMaintenance}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Preventivos", href: navigationHrefs.preventiveMaintenance },
          { label: "Nuevo preventivo" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos del mantenimiento preventivo
            </CardTitle>
          </CardHeader>

          <CardContent>
            {machines.length === 0 ? (
              <EmptyState
                label="No hay maquinas registradas."
                description="Primero registra una maquina para poder programar mantenimientos preventivos."
                action={
                  <Button asChild>
                    <Link href="/dashboard/maintenance/machines/new">
                      Registrar maquina
                    </Link>
                  </Button>
                }
              />
            ) : (
              <form
                action={createPreventiveMaintenanceAction}
                className="space-y-4"
              >
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

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="fecha_programada">Fecha programada</Label>
                    <Input
                      id="fecha_programada"
                      name="fecha_programada"
                      type="date"
                      required
                      defaultValue={today}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado inicial</Label>
                    <NativeSelect
                      id="estado"
                      name="estado"
                      required
                      defaultValue="pendiente"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="realizado">Realizado</option>
                      <option value="vencido">Vencido</option>
                      <option value="anulado">Anulado</option>
                    </NativeSelect>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responsable">Responsable</Label>
                    <Input
                      id="responsable"
                      name="responsable"
                      type="text"
                      placeholder="Ejemplo: Maestro de taller"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actividad">Actividad preventiva</Label>
                  <Input
                    id="actividad"
                    name="actividad"
                    type="text"
                    required
                    placeholder="Ejemplo: Lubricacion general y revision de presion hidraulica"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Ejemplo: Revisar mangueras, pernos, fugas y nivel de aceite."
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit">Programar preventivo</Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/maintenance/preventive">
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
              Programa mantenimientos preventivos para maquinas criticas como
              prensas, cortadoras, soldadoras, compresoras o dobladoras.
            </p>

            <p>
              Manten el estado como <strong>Pendiente</strong> hasta que se
              realice la actividad. Al marcarlo como{" "}
              <strong>Realizado</strong>, el sistema registrara la fecha real de
              ejecucion.
            </p>

            <p>
              Los preventivos ayudan a reducir fallas inesperadas y costos por
              paradas de produccion.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
