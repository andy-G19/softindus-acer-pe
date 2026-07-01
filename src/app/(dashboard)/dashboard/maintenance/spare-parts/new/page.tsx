import Link from "next/link";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import { createSparePartAction } from "@/modules/maintenance/spare-parts/actions";

export default async function NewSparePartPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const providers = await prisma.proveedor.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      razon_social: "asc",
    },
  });

  const providerItems = providers.map((provider) => ({
    id: provider.id_proveedor,
    label: provider.razon_social,
  }));

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Mantenimiento de maquinaria - Nuevo repuesto
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar repuesto
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra repuestos que podran usarse luego en reparaciones de
            maquinaria, incluyendo proveedor, descripcion y costo unitario.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 9.4</Badge>
          <Badge>Solo ADMIN</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Datos principales del repuesto
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form action={createSparePartAction} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="nombre_repuesto" className="text-sm font-medium">
                  Nombre del repuesto
                </label>

                <input
                  id="nombre_repuesto"
                  name="nombre_repuesto"
                  type="text"
                  required
                  placeholder="Ejemplo: Manguera hidraulica"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <SearchableSelect
                    name="id_proveedor"
                    label="Proveedor"
                    placeholder="Buscar proveedor..."
                    items={providerItems}
                    emptyMessage="No hay proveedores activos."
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="costo_unitario" className="text-sm font-medium">
                    Costo unitario
                  </label>

                  <input
                    id="costo_unitario"
                    name="costo_unitario"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="Ejemplo: 35.00"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="estado" className="text-sm font-medium">
                  Estado inicial
                </label>

                <select
                  id="estado"
                  name="estado"
                  required
                  defaultValue="true"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="descripcion" className="text-sm font-medium">
                  Descripcion
                </label>

                <textarea
                  id="descripcion"
                  name="descripcion"
                  rows={4}
                  placeholder="Ejemplo: Repuesto usado para mantenimiento del sistema hidraulico."
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar repuesto
                </button>

                <Link
                  href="/dashboard/maintenance/spare-parts"
                  className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                >
                  Ver listado
                </Link>

                <Link
                  href="/dashboard/maintenance"
                  className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                >
                  Volver al modulo
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendacion</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Registra repuestos criticos como mangueras, fajas, rodamientos,
              electrodos, cables, interruptores, discos o piezas de desgaste.
            </p>

            <p>
              El proveedor es opcional porque algunos repuestos pueden ser
              comprados de forma eventual o aun no tener proveedor definido.
            </p>

            <p>
              En la siguiente subfase usaremos estos repuestos para calcular el
              costo real de cada reparacion.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
