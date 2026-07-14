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
import { formatDateTime } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createRepairAction } from "@/modules/maintenance/repairs/actions";

function getTodayValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 10);
}

function getFailureStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    en_atencion: "En atencion",
    reparada: "Reparada",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

export default async function NewRepairPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const failures = await prisma.falla_maquina.findMany({
    where: {
      estado_atencion: {
        in: ["pendiente", "en_atencion"],
      },
    },
    orderBy: {
      fecha_falla: "desc",
    },
    include: {
      maquina: true,
    },
  });

  const spareParts = await prisma.repuesto.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      nombre_repuesto: "asc",
    },
  });

  const today = getTodayValue();
  const failureItems = failures.map((failure) => ({
    id: failure.id_falla,
    label: failure.maquina.nombre,
    description: `${formatDateTime(failure.fecha_falla)} - ${getFailureStatusLabel(
      failure.estado_atencion,
    )}`,
  }));
  const sparePartItems = spareParts.map((sparePart) => ({
    id: sparePart.id_repuesto,
    label: sparePart.nombre_repuesto,
    description: `S/ ${sparePart.costo_unitario.toString()}`,
  }));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar reparacion"
        description="Registra la atencion realizada a una falla, incluyendo tecnico, mano de obra, repuestos utilizados y costo total calculado."
        backHref={navigationHrefs.repairs}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Reparaciones", href: navigationHrefs.repairs },
          { label: "Nueva reparación" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos de la reparacion</CardTitle>
          </CardHeader>

          <CardContent>
            {failures.length === 0 ? (
              <EmptyState
                label="No hay fallas pendientes o en atencion."
                description="Primero registra una falla para poder asociarle una reparacion."
                action={
                  <Button asChild>
                    <Link href="/dashboard/maintenance/failures/new">
                      Registrar falla
                    </Link>
                  </Button>
                }
              />
            ) : (
              <form action={createRepairAction} className="space-y-5">
                <div className="space-y-2">
                  <SearchableSelect
                    name="id_falla"
                    label="Falla a reparar"
                    placeholder="Buscar falla por maquina..."
                    items={failureItems}
                    required
                    emptyMessage="No hay fallas pendientes o en atencion."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="fecha_reparacion">Fecha de reparacion</Label>
                    <Input
                      id="fecha_reparacion"
                      name="fecha_reparacion"
                      type="date"
                      required
                      defaultValue={today}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado_reparacion">Estado</Label>
                    <NativeSelect
                      id="estado_reparacion"
                      name="estado_reparacion"
                      required
                      defaultValue="programada"
                    >
                      <option value="programada">Programada</option>
                      <option value="ejecutada">Ejecutada</option>
                      <option value="observada">Observada</option>
                      <option value="anulada">Anulada</option>
                    </NativeSelect>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mano_obra">Mano de obra</Label>
                    <Input
                      id="mano_obra"
                      name="mano_obra"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ejemplo: 80.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tecnico_proveedor">Tecnico o proveedor</Label>
                  <Input
                    id="tecnico_proveedor"
                    name="tecnico_proveedor"
                    type="text"
                    placeholder="Ejemplo: Tecnico interno / proveedor externo"
                  />
                </div>

                <div className="rounded-lg border border-border/80 bg-secondary/40 p-4">
                  <div>
                    <h2 className="text-base font-semibold">
                      Repuestos usados
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Puedes registrar hasta 3 repuestos en esta version. El
                      costo unitario se tomara automaticamente del catalogo de
                      repuestos.
                    </p>
                  </div>

                  <div className="mt-4 space-y-4">
                    {[1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="grid gap-4 md:grid-cols-[1fr_160px]"
                      >
                        <div className="space-y-2">
                          <SearchableSelect
                            name={`id_repuesto_${index}`}
                            label={`Repuesto ${index}`}
                            placeholder="Buscar repuesto..."
                            items={sparePartItems}
                            emptyMessage="No hay repuestos activos."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`cantidad_${index}`}>Cantidad</Label>
                          <Input
                            id={`cantidad_${index}`}
                            name={`cantidad_${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Ejemplo: 1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Ejemplo: Se cambio la manguera hidraulica y se realizo prueba de presion."
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit">Registrar reparacion</Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/maintenance/repairs">
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
            <CardTitle className="text-base">Calculo automatico</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              El costo total se calcula automaticamente sumando la mano de obra
              mas los subtotales de los repuestos usados.
            </p>

            <p>
              Si registras una reparacion como <strong>Ejecutada</strong>, la
              falla pasara a <strong>Reparada</strong> y la maquina volvera a
              estado <strong>Operativa</strong>.
            </p>

            <p>
              Si la reparacion queda programada u observada, la falla pasara a
              <strong> En atencion</strong> y la maquina quedara en{" "}
              <strong>En mantenimiento</strong>.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
