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
import { createScrapAction } from "@/modules/waste-scrap/scraps/actions";

export default async function NewScrapPage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const materials = await prisma.material.findMany({
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
  });

  const materialItems = materials.map((material) => ({
    id: material.id_material,
    label: material.nombre_material,
    description: `${material.categoria} - Stock: ${material.stock_actual.toString()} ${material.unidad_medida}`,
  }));

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Mermas y chatarra · Chatarra generada
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar chatarra generada
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra sobrantes no reutilizables generados durante el corte,
            fabricación o limpieza del área productiva. La chatarra quedará
            acumulada hasta que se registre su venta.
          </p>
        </div>

        <Link
          href="/dashboard/waste-scrap"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Volver al módulo
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la chatarra</CardTitle>
        </CardHeader>

        <CardContent>
          <form action={createScrapAction} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <SearchableSelect
                  name="id_material"
                  label="Material de origen"
                  placeholder="Buscar material..."
                  items={materialItems}
                  emptyMessage="No hay materiales activos disponibles."
                />

                <p className="text-xs text-slate-500">
                  Selecciona el material si se conoce el origen. Si la chatarra
                  está mezclada, puedes dejarlo como no identificado.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="tipo_material"
                  className="text-sm font-medium text-slate-700"
                >
                  Tipo de material *
                </label>

                <input
                  id="tipo_material"
                  name="tipo_material"
                  type="text"
                  required
                  placeholder="Ejemplo: acero, fierro, plancha, tubo, mixto"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />

                <p className="text-xs text-slate-500">
                  Este campo ayuda a clasificar la chatarra cuando se venda o se
                  consulte el historial.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="peso_kg"
                  className="text-sm font-medium text-slate-700"
                >
                  Peso en kg
                </label>

                <input
                  id="peso_kg"
                  name="peso_kg"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ejemplo: 12.50"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />

                <p className="text-xs text-slate-500">
                  Recomendado cuando la chatarra se controla por peso.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="cantidad"
                  className="text-sm font-medium text-slate-700"
                >
                  Cantidad aproximada
                </label>

                <input
                  id="cantidad"
                  name="cantidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ejemplo: 3"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />

                <p className="text-xs text-slate-500">
                  Útil cuando se registra por bolsas, piezas, baldes o grupos.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="observaciones"
                  className="text-sm font-medium text-slate-700"
                >
                  Observaciones
                </label>

                <textarea
                  id="observaciones"
                  name="observaciones"
                  rows={4}
                  placeholder="Ejemplo: chatarra generada durante corte de planchas para lampas"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">
                Estado inicial de la chatarra
              </p>
              <p className="mt-1">
                Todo registro de chatarra se guardará inicialmente con estado{" "}
                <span className="font-semibold">acumulada</span>. Cuando se
                registre una venta, el estado cambiará a{" "}
                <span className="font-semibold">vendida</span>.
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
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Guardar chatarra
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
