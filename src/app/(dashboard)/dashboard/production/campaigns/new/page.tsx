import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
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
      <section>
        <p className="text-sm font-medium text-slate-500">
          Produccion · Campanias
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Nueva campania de produccion
        </h1>

        <p className="text-slate-600">
          Registra una campania para agrupar objetivos de produccion por
          producto y asociarla luego a ordenes de trabajo.
        </p>
      </section>

      <form
        action={createProductionCampaignAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre de la campania *</label>

          <input
            name="nombre_campania"
            required
            maxLength={100}
            placeholder="Ej. Campania escolar agosto"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de inicio *</label>

            <input
              name="fecha_inicio"
              type="date"
              required
              defaultValue={getTodayInputValue()}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de fin</label>

            <input
              name="fecha_fin"
              type="date"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </section>

        <div className="space-y-2">
          <label className="text-sm font-medium">Estado *</label>

          <select
            name="estado"
            required
            defaultValue="planificada"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
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
            maxLength={700}
            placeholder="Ej. Fabricar lote de herramientas para reposicion de stock."
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href="/dashboard/production/campaigns"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Guardar campania
          </button>
        </div>
      </form>
    </main>
  );
}
