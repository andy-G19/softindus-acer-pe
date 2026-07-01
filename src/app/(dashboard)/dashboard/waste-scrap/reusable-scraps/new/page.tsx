import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import { createReusableScrapAction } from "@/modules/waste-scrap/reusable-scraps/actions";

export default async function NewReusableScrapPage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const [materials, workOrders] = await Promise.all([
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
        unidad_medida: true,
        stock_actual: true,
      },
    }),

    prisma.orden_trabajo.findMany({
      where: {
        estado: {
          not: "anulada",
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
      take: 50,
      include: {
        producto: true,
        cliente: true,
      },
    }),
  ]);

  const materialItems = materials.map((material) => ({
    id: material.id_material,
    label: material.nombre_material,
    description: `${material.categoria} - Stock: ${material.stock_actual.toString()} ${material.unidad_medida}`,
  }));

  const workOrderItems = workOrders.map((order) => ({
    id: order.id_orden_trabajo,
    label: `${order.id_orden_trabajo} - ${order.producto.nombre_producto}`,
    description: order.cliente
      ? `${order.estado} - ${order.cliente.nombre_razon_social}`
      : order.estado,
  }));

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Mermas y chatarra · Retazos reutilizables
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar retazo reutilizable
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra sobrantes aprovechables generados durante el corte o la
            producción. Estos retazos quedarán disponibles para reutilización
            futura dentro del taller.
          </p>
        </div>

        <Link
          href="/dashboard/waste-scrap"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Volver al módulo
        </Link>
      </section>

      {materials.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">No hay materiales activos.</p>
          <p className="mt-1">
            Primero registra materiales o insumos en el módulo de inventario.
          </p>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Datos del retazo</CardTitle>
        </CardHeader>

        <CardContent>
          <form action={createReusableScrapAction} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <SearchableSelect
                  name="id_material"
                  label="Material de origen"
                  placeholder="Buscar material..."
                  items={materialItems}
                  required
                  disabled={materials.length === 0}
                  emptyMessage="No hay materiales activos disponibles."
                />

                <p className="text-xs text-slate-500">
                  El tipo de material del retazo se tomará automáticamente desde
                  la categoría del material seleccionado.
                </p>
              </div>

              <div className="space-y-2">
                <SearchableSelect
                  name="id_orden_trabajo"
                  label="Orden de trabajo relacionada"
                  placeholder="Buscar orden..."
                  items={workOrderItems}
                  emptyMessage="No hay órdenes de trabajo disponibles."
                />

                <p className="text-xs text-slate-500">
                  Usa este campo cuando el retazo provenga de una orden
                  productiva identificable.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="medida_aproximada"
                  className="text-sm font-medium text-slate-700"
                >
                  Medida aproximada
                </label>

                <input
                  id="medida_aproximada"
                  name="medida_aproximada"
                  type="text"
                  placeholder="Ejemplo: 30 cm x 15 cm"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="ubicacion"
                  className="text-sm font-medium text-slate-700"
                >
                  Ubicación física
                </label>

                <input
                  id="ubicacion"
                  name="ubicacion"
                  type="text"
                  placeholder="Ejemplo: Estante A, zona de corte"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="cantidad"
                  className="text-sm font-medium text-slate-700"
                >
                  Cantidad *
                </label>

                <input
                  id="cantidad"
                  name="cantidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Ejemplo: 2"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="unidad_medida"
                  className="text-sm font-medium text-slate-700"
                >
                  Unidad de medida *
                </label>

                <select
                  id="unidad_medida"
                  name="unidad_medida"
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecciona una unidad
                  </option>
                  <option value="unidad">Unidad</option>
                  <option value="kg">Kg</option>
                  <option value="metro">Metro</option>
                  <option value="plancha">Plancha</option>
                  <option value="pieza">Pieza</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">
                Estado inicial del retazo
              </p>
              <p className="mt-1">
                Todo retazo registrado se guardará inicialmente con estado{" "}
                <span className="font-semibold">disponible</span>. En una fase
                posterior podremos marcarlo como reutilizado o descartado.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <Link
                href="/dashboard/waste-scrap"
                className="rounded-lg border px-4 py-2 text-center text-sm font-medium hover:bg-slate-50"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={materials.length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Guardar retazo
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
