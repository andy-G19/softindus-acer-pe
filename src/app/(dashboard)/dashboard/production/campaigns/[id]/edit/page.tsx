import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { updateProductionCampaignAction } from "@/modules/production/campaigns/actions";

type EditProductionCampaignPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function formatDateInput(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

export default async function EditProductionCampaignPage({
  params,
}: EditProductionCampaignPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

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
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Esta campaña está anulada y ya no puede modificarse.
        </section>
      ) : null}

      <form
        action={updateProductionCampaignAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="id_campania" value={campaign.id_campania} />

        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre *</label>

          <input
            name="nombre_campania"
            required
            maxLength={100}
            defaultValue={campaign.nombre_campania}
            disabled={isVoided}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de inicio *</label>

            <input
              name="fecha_inicio"
              type="date"
              required
              defaultValue={formatDateInput(campaign.fecha_inicio)}
              disabled={isVoided}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de fin</label>

            <input
              name="fecha_fin"
              type="date"
              defaultValue={formatDateInput(campaign.fecha_fin)}
              disabled={isVoided}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Estado</label>

          <select
            name="estado"
            defaultValue={campaign.estado}
            disabled={isVoided}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          >
            <option value="planificada">Planificada</option>
            <option value="activa">Activa</option>
            <option value="finalizada">Finalizada</option>
            <option value="anulada">Anulada</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Objetivo general</label>

          <textarea
            name="objetivo_general"
            rows={4}
            defaultValue={campaign.objetivo_general ?? ""}
            disabled={isVoided}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href={`/dashboard/production/campaigns/${campaign.id_campania}`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Volver a detalle
          </Link>

          <button
            type="submit"
            disabled={isVoided}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </main>
  );
}
