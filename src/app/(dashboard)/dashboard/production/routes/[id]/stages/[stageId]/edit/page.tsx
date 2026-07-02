import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateRouteStageAction } from "@/modules/production/stages/actions";

type EditRouteStagePageProps = {
  params: Promise<{
    id: string;
    stageId: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function formatDecimalInput(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return Number(value.toString()).toString();
}

export default async function EditRouteStagePage({
  params,
}: EditRouteStagePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id, stageId } = await params;

  const stage = await prisma.etapa_ruta.findFirst({
    where: {
      id_etapa_ruta: stageId,
      id_ruta: id,
    },
    include: {
      ruta_fabricacion: {
        include: {
          producto: true,
        },
      },
      _count: {
        select: {
          avance_orden: true,
          tarea_operario: true,
        },
      },
    },
  });

  if (!stage) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Produccion - Rutas de fabricacion - Etapas
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Editar etapa de ruta
        </h1>

        <p className="mt-2 text-slate-600">
          Ruta:{" "}
          <span className="font-medium">
            {stage.ruta_fabricacion.nombre_ruta}
          </span>{" "}
          - Producto:{" "}
          <span className="font-medium">
            {stage.ruta_fabricacion.producto.nombre_producto}
          </span>
        </p>
      </section>

      {stage._count.avance_orden > 0 || stage._count.tarea_operario > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta etapa ya tiene trazabilidad operativa. Los cambios quedan
          auditados; evita alterar su significado productivo si ya fue usada.
        </section>
      ) : null}

      <form
        action={updateRouteStageAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="id_ruta" value={stage.id_ruta} />
        <input
          type="hidden"
          name="id_etapa_ruta"
          value={stage.id_etapa_ruta}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre de la etapa *</label>

          <input
            name="nombre_etapa"
            required
            maxLength={100}
            defaultValue={stage.nombre_etapa}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Orden de ejecucion *</label>

            <input
              name="orden_secuencia"
              type="number"
              min={1}
              max={999}
              required
              defaultValue={stage.orden_secuencia}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Tiempo estimado en horas
            </label>

            <input
              name="tiempo_estimado_horas"
              type="number"
              min="0"
              step="0.01"
              defaultValue={formatDecimalInput(stage.tiempo_estimado_horas)}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Descripcion tecnica</label>

          <textarea
            name="descripcion"
            rows={4}
            maxLength={500}
            defaultValue={stage.descripcion ?? ""}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4 text-sm">
          <input
            type="checkbox"
            name="requiere_maquina"
            defaultChecked={stage.requiere_maquina}
            className="mt-1"
          />

          <span>
            <span className="block font-medium text-slate-900">
              Esta etapa requiere maquina o equipo critico
            </span>

            <span className="text-slate-600">
              Se usara para identificar posibles cuellos de botella.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-between pt-4">
          <Link
            href={`/dashboard/production/routes/${stage.id_ruta}/stages`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Volver a etapas
          </Link>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </main>
  );
}
