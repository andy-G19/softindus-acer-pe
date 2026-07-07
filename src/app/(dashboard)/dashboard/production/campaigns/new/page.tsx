import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createProductionCampaignAction } from "@/modules/production/campaigns/actions";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewProductionCampaignPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nueva campaña de producción"
        description="Registra una campaña para agrupar objetivos de producción por producto y asociarla luego a órdenes de trabajo."
        backHref={navigationHrefs.campaigns}
        backLabel="Volver a campañas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Campañas", href: navigationHrefs.campaigns },
          { label: "Nueva campaña" },
        ])}
      />

      <form
        action={createProductionCampaignAction}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <div className="space-y-2">
          <Label>Nombre de la campaña *</Label>
          <Input
            name="nombre_campania"
            required
            maxLength={100}
            placeholder="Ej. Campaña escolar agosto"
          />
        </div>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Fecha de inicio *</Label>
            <Input
              name="fecha_inicio"
              type="date"
              required
              defaultValue={getTodayInputValue()}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha de fin</Label>
            <Input name="fecha_fin" type="date" />
          </div>
        </section>

        <div className="space-y-2">
          <Label>Estado *</Label>
          <NativeSelect name="estado" required defaultValue="planificada">
            <option value="planificada">Planificada</option>
            <option value="activa">Activa</option>
            <option value="finalizada">Finalizada</option>
            <option value="anulada">Anulada</option>
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label>Objetivo general</Label>
          <Textarea
            name="objetivo_general"
            rows={4}
            maxLength={700}
            placeholder="Ej. Fabricar lote de herramientas para reposición de stock."
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href="/dashboard/production/campaigns">Cancelar</Link>
          </Button>

          <Button type="submit">Guardar campaña</Button>
        </div>
      </form>
    </main>
  );
}
