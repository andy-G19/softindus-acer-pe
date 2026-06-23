import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { attendStockAlertAction } from "@/modules/inventory/alerts/actions";

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

function assertCanViewInventory(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

export default async function InventoryAlertsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  assertCanViewInventory(session.user.role);

  const isAdmin = session.user.role === "ADMIN";

  const [materials, alerts] = await Promise.all([
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
    }),
    prisma.alerta_stock.findMany({
      orderBy: {
        fecha_alerta: "desc",
      },
    }),
  ]);

  const criticalMaterials = materials.filter((material) => {
    const stockActual = Number(material.stock_actual.toString());
    const stockReservado = Number(material.stock_reservado.toString());
    const stockMinimo = Number(material.stock_minimo.toString());
    const stockDisponible = stockActual - stockReservado;

    return stockMinimo > 0 && stockDisponible <= stockMinimo;
  });

  const materialIds = [...new Set(alerts.map((alert) => alert.id_material))];

  const alertMaterials = await prisma.material.findMany({
    where: {
      id_material: {
        in: materialIds,
      },
    },
  });

  const materialById = new Map(
    alertMaterials.map((material) => [material.id_material, material]),
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Alertas
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Alertas y stock crítico
          </h1>
          <p className="text-slate-600">
            Consulta materiales por debajo del stock mínimo y alertas generadas
            por el sistema.
          </p>
        </div>

        <Link
          href="/dashboard/inventory"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Volver al módulo
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Materiales activos</p>
          <p className="mt-2 text-3xl font-bold">{materials.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Materiales críticos</p>
          <p className="mt-2 text-3xl font-bold">{criticalMaterials.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Alertas activas</p>
          <p className="mt-2 text-3xl font-bold">
            {alerts.filter((alert) => alert.estado_alerta === "activa").length}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Stock crítico actual</h2>
          <p className="text-sm text-slate-600">
            Materiales cuyo stock disponible está igual o por debajo del stock
            mínimo.
          </p>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Stock actual</th>
              <th className="px-4 py-3 font-semibold">Reservado</th>
              <th className="px-4 py-3 font-semibold">Disponible</th>
              <th className="px-4 py-3 font-semibold">Stock mínimo</th>
              <th className="px-4 py-3 font-semibold">Unidad</th>
            </tr>
          </thead>

          <tbody>
            {criticalMaterials.map((material) => {
              const stockActual = Number(material.stock_actual.toString());
              const stockReservado = Number(material.stock_reservado.toString());
              const stockDisponible = stockActual - stockReservado;

              return (
                <tr key={material.id_material} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {material.nombre_material}
                  </td>
                  <td className="px-4 py-3">{material.categoria}</td>
                  <td className="px-4 py-3">
                    {formatDecimal(material.stock_actual)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDecimal(material.stock_reservado)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                      {stockDisponible.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {formatDecimal(material.stock_minimo)}
                  </td>
                  <td className="px-4 py-3">{material.unidad_medida}</td>
                </tr>
              );
            })}

            {criticalMaterials.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay materiales en stock crítico.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Historial de alertas</h2>
          <p className="text-sm text-slate-600">
            Alertas generadas cuando un material llega al stock mínimo.
          </p>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Stock detectado</th>
              <th className="px-4 py-3 font-semibold">Stock mínimo</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Mensaje</th>
              {isAdmin ? (
                <th className="px-4 py-3 font-semibold">Acción</th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {alerts.map((alert) => {
              const material = materialById.get(alert.id_material);
              const isActive = alert.estado_alerta === "activa";

              return (
                <tr key={alert.id_alerta} className="border-t">
                  <td className="px-4 py-3">
                    {formatDate(alert.fecha_alerta)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {material?.nombre_material ?? alert.id_material}
                  </td>
                  <td className="px-4 py-3">
                    {formatDecimal(alert.stock_detectado)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDecimal(alert.stock_minimo)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        isActive
                          ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                          : "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                      }
                    >
                      {alert.estado_alerta}
                    </span>
                  </td>
                  <td className="px-4 py-3">{alert.mensaje ?? "-"}</td>

                  {isAdmin ? (
                    <td className="px-4 py-3">
                      {isActive ? (
                        <form action={attendStockAlertAction}>
                          <input
                            type="hidden"
                            name="id_alerta"
                            value={alert.id_alerta}
                          />
                          <button
                            type="submit"
                            className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                          >
                            Marcar atendida
                          </button>
                        </form>
                      ) : (
                        "-"
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {alerts.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 7 : 6}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Todavía no hay alertas registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}