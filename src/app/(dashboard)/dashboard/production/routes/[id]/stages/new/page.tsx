import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createRouteStageAction } from "@/modules/production/stages/actions";

type NewRouteStagePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

export default async function NewRouteStagePage({
  params,
}: NewRouteStagePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

  const route = await prisma.ruta_fabricacion.findUnique({
    where: {
      id_ruta: id,
    },
    include: {
      producto: true,
      etapa_ruta: {
        orderBy: {
          orden_secuencia: "desc",
        },
        take: 1,
      },
    },
  });

  if (!route) {
    notFound();
  }

  const suggestedOrder = (route.etapa_ruta[0]?.orden_secuencia ?? 0) + 1;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Producción · Rutas de fabricación · Etapas
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Nueva etapa de ruta
        </h1>

        <p className="mt-2 text-slate-600">
          Ruta: <span className="font-medium">{route.nombre_ruta}</span> ·
          Producto:{" "}
          <span className="font-medium">{route.producto.nombre_producto}</span>
        </p>
      </section>

      {!route.estado ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta ruta está inactiva. Actívala antes de agregar nuevas etapas.
        </section>
      ) : null}

      <form
        action={createRouteStageAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="id_ruta" value={route.id_ruta} />

        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre de la etapa *</label>

          <input
            name="nombre_etapa"
            required
            maxLength={100}
            placeholder="Ej. Corte de plancha"
            disabled={!route.estado}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Orden de ejecución *</label>

            <input
              name="orden_secuencia"
              type="number"
              min={1}
              max={999}
              required
              defaultValue={suggestedOrder}
              disabled={!route.estado}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Tiempo estimado en horas
            </label>

            <input
              name="tiempo_estimado_horas"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ej. 1.50"
              disabled={!route.estado}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Descripción técnica</label>

          <textarea
            name="descripcion"
            rows={4}
            maxLength={500}
            placeholder="Ej. Se corta la plancha según medida base antes del formado."
            disabled={!route.estado}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4 text-sm">
          <input
            type="checkbox"
            name="requiere_maquina"
            disabled={!route.estado}
            className="mt-1"
          />

          <span>
            <span className="block font-medium text-slate-900">
              Esta etapa requiere máquina o equipo crítico
            </span>

            <span className="text-slate-600">
              Marca esta opción para etapas como corte, prensa, soldadura,
              esmerilado u otros procesos que dependan de maquinaria.
            </span>
          </span>
        </label>

        <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Recomendación</p>
          <p className="mt-1">
            Usa números consecutivos: 1, 2, 3, 4... Esto permitirá calcular
            correctamente el flujo de producción y mostrar avances ordenados.
          </p>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href={`/dashboard/production/routes/${route.id_ruta}/stages`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={!route.estado}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Guardar etapa
          </button>
        </div>
      </form>
    </main>
  );
}