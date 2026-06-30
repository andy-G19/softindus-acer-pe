import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

type AlertStatus = "normal" | "en riesgo" | "atrasada";

type StageSummary = {
  id: string;
  name: string;
  orderCount: number;
  delayedCount: number;
  riskCount: number;
  maxElapsedHours: number;
  estimatedHours: number | null;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value.toString());

  return Number.isFinite(numericValue) ? numericValue : null;
}

function getElapsedHours(startDate: Date | null | undefined, now: Date) {
  if (!startDate) {
    return 0;
  }

  const elapsedMilliseconds = now.getTime() - startDate.getTime();

  return Math.max(elapsedMilliseconds / 1000 / 60 / 60, 0);
}

function getAlertStatus(
  estimatedHours: number | null,
  elapsedHours: number,
): AlertStatus {
  if (!estimatedHours || estimatedHours <= 0) {
    return "normal";
  }

  if (elapsedHours > estimatedHours) {
    return "atrasada";
  }

  if (elapsedHours >= estimatedHours * 0.8) {
    return "en riesgo";
  }

  return "normal";
}

function getAlertClass(status: AlertStatus) {
  if (status === "atrasada") {
    return "bg-red-50 text-red-700";
  }

  if (status === "en riesgo") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-emerald-50 text-emerald-700";
}

function formatHours(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(2)} h`;
}

export default async function ProductionBottlenecksPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const activeAdvances = await prisma.avance_orden.findMany({
    where: {
      estado_etapa: "en_proceso",
    },
    include: {
      etapa_ruta: true,
      operario: true,
      orden_trabajo: {
        include: {
          producto: true,
        },
      },
    },
    orderBy: [
      {
        fecha_inicio_etapa: "asc",
      },
      {
        id_avance: "asc",
      },
    ],
  });

  const now = new Date();

  const rows = activeAdvances.map((advance) => {
    const estimatedHours = toNumber(advance.etapa_ruta.tiempo_estimado_horas);
    const elapsedHours = getElapsedHours(advance.fecha_inicio_etapa, now);
    const alertStatus = getAlertStatus(estimatedHours, elapsedHours);

    return {
      id_avance: advance.id_avance,
      id_orden_trabajo: advance.id_orden_trabajo,
      productName: advance.orden_trabajo.producto.nombre_producto,
      stageId: advance.id_etapa_ruta,
      stageName: advance.etapa_ruta.nombre_etapa,
      stageOrder: advance.etapa_ruta.orden_secuencia,
      operatorName: advance.operario
        ? `${advance.operario.apellidos}, ${advance.operario.nombres}`
        : "Sin operario asignado",
      estimatedHours,
      elapsedHours,
      alertStatus,
    };
  });

  const stageSummaries = Array.from(
    rows
      .reduce((summaryMap, row) => {
        const current = summaryMap.get(row.stageId) ?? {
          id: row.stageId,
          name: row.stageName,
          orderCount: 0,
          delayedCount: 0,
          riskCount: 0,
          maxElapsedHours: 0,
          estimatedHours: row.estimatedHours,
        };

        current.orderCount += 1;
        current.maxElapsedHours = Math.max(
          current.maxElapsedHours,
          row.elapsedHours,
        );

        if (row.alertStatus === "atrasada") {
          current.delayedCount += 1;
        }

        if (row.alertStatus === "en riesgo") {
          current.riskCount += 1;
        }

        summaryMap.set(row.stageId, current);

        return summaryMap;
      }, new Map<string, StageSummary>())
      .values(),
  ).sort((a, b) => {
    if (b.orderCount !== a.orderCount) {
      return b.orderCount - a.orderCount;
    }

    if (b.delayedCount !== a.delayedCount) {
      return b.delayedCount - a.delayedCount;
    }

    return b.maxElapsedHours - a.maxElapsedHours;
  });

  const delayedRows = rows.filter((row) => row.alertStatus === "atrasada");
  const riskRows = rows.filter((row) => row.alertStatus === "en riesgo");
  const saturatedStages = stageSummaries.filter(
    (summary) => summary.orderCount > 1,
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Produccion - Cuellos de botella
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Cuellos de botella en produccion
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Detecta avances en proceso que estan cerca de vencer, atrasados o
            concentrados en la misma etapa.
          </p>
        </div>

        <Link
          href="/dashboard/production"
          className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Volver a produccion
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Avances en proceso</p>
          <p className="mt-2 text-3xl font-bold">{rows.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Atrasados</p>
          <p className="mt-2 text-3xl font-bold">{delayedRows.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">En riesgo</p>
          <p className="mt-2 text-3xl font-bold">{riskRows.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Etapas saturadas</p>
          <p className="mt-2 text-3xl font-bold">{saturatedStages.length}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-xl font-semibold">Resumen por etapa</h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Etapa</th>
              <th className="px-4 py-3 font-semibold">Ordenes en etapa</th>
              <th className="px-4 py-3 font-semibold">Atrasadas</th>
              <th className="px-4 py-3 font-semibold">En riesgo</th>
              <th className="px-4 py-3 font-semibold">Tiempo estimado</th>
              <th className="px-4 py-3 font-semibold">Mayor permanencia</th>
              <th className="px-4 py-3 font-semibold">Saturacion</th>
            </tr>
          </thead>

          <tbody>
            {stageSummaries.map((summary) => (
              <tr key={summary.id} className="border-t">
                <td className="px-4 py-3 font-medium">{summary.name}</td>
                <td className="px-4 py-3">{summary.orderCount}</td>
                <td className="px-4 py-3">{summary.delayedCount}</td>
                <td className="px-4 py-3">{summary.riskCount}</td>
                <td className="px-4 py-3">
                  {formatHours(summary.estimatedHours)}
                </td>
                <td className="px-4 py-3">
                  {formatHours(summary.maxElapsedHours)}
                </td>
                <td className="px-4 py-3">
                  {summary.orderCount > 1 ? (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      Saturada
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      Normal
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {stageSummaries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay avances en proceso para analizar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-xl font-semibold">Avances monitoreados</h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Codigo de orden</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Etapa</th>
              <th className="px-4 py-3 font-semibold">Operario</th>
              <th className="px-4 py-3 font-semibold">Horas estimadas</th>
              <th className="px-4 py-3 font-semibold">Horas transcurridas</th>
              <th className="px-4 py-3 font-semibold">Estado de alerta</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id_avance} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/dashboard/production/work-orders/${row.id_orden_trabajo}/progress`}
                    className="font-medium text-slate-700 hover:text-slate-950"
                  >
                    {row.id_orden_trabajo}
                  </Link>
                </td>
                <td className="px-4 py-3">{row.productName}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.stageName}</div>
                  <p className="mt-1 text-xs text-slate-500">
                    Secuencia: {row.stageOrder}
                  </p>
                </td>
                <td className="px-4 py-3">{row.operatorName}</td>
                <td className="px-4 py-3">{formatHours(row.estimatedHours)}</td>
                <td className="px-4 py-3">{formatHours(row.elapsedHours)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getAlertClass(
                      row.alertStatus,
                    )}`}
                  >
                    {row.alertStatus}
                  </span>
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay avances con estado en_proceso.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
