import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { updateProductionCampaignAction } from "@/modules/production/campaigns/actions";

type EditProductionCampaignPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateInput(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

export default async function EditProductionCampaignPage({
  params,
}: EditProductionCampaignPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;

  const campaign = await prisma.campania_produccion.findUnique({
    where: {
      id_campania: id,
    },
  });

  if (!campaign) {
    notFound();
  }

  const isVoided = campaign.estado === "anulada";

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Editar campaña"
        description="Actualiza los datos generales y el estado operativo de la campaña."
        backHref={`${navigationHrefs.campaigns}/${campaign.id_campania}`}
        backLabel="Volver a detalle"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Campañas", href: navigationHrefs.campaigns },
          { label: "Editar campaña" },
        ])}
      />

      {isVoided ? (
        <Alert variant="destructive">
          <AlertDescription>
            Esta campaña está anulada y ya no puede modificarse.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        action={updateProductionCampaignAction}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="id_campania" value={campaign.id_campania} />

        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input
            name="nombre_campania"
            required
            maxLength={100}
            defaultValue={campaign.nombre_campania}
            disabled={isVoided}
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Fecha de inicio *</Label>
            <Input
              name="fecha_inicio"
              type="date"
              required
              defaultValue={formatDateInput(campaign.fecha_inicio)}
              disabled={isVoided}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha de fin</Label>
            <Input
              name="fecha_fin"
              type="date"
              defaultValue={formatDateInput(campaign.fecha_fin)}
              disabled={isVoided}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Estado</Label>
          <NativeSelect
            name="estado"
            defaultValue={campaign.estado}
            disabled={isVoided}
          >
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
            defaultValue={campaign.objetivo_general ?? ""}
            disabled={isVoided}
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={`/dashboard/production/campaigns/${campaign.id_campania}`}>
              Volver a detalle
            </Link>
          </Button>

          <Button type="submit" disabled={isVoided}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </main>
  );
}
