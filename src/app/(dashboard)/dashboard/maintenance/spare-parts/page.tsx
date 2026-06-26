import Link from "next/link";

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
import { updateSparePartStatusAction } from "@/modules/maintenance/spare-parts/actions";

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function getStatusLabel(status: boolean) {
  return status ? "Activo" : "Inactivo";
}

function getStatusBadgeVariant(status: boolean) {
  return status ? "default" : "secondary";
}

export default async function SparePartsPage() {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const canManageSpareParts = session.user.role === APP_ROLES.ADMIN;

  const spareParts = await prisma.repuesto.findMany({
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre_repuesto: "asc",
      },
    ],
    include: {
      proveedor: true,
      _count: {
        select: {
          detalle_repuesto_reparacion: true,
        },
      },
    },
  });

  const activeSpareParts = spareParts.filter((sparePart) => sparePart.estado);
  const inactiveSpareParts = spareParts.filter((sparePart) => !sparePart.estado);

  const sparePartsWithProvider = spareParts.filter(
    (sparePart) => sparePart.id_proveedor !== null,
  );

  const sparePartsWithoutProvider = spareParts.filter(
    (sparePart) => sparePart.id_proveedor === null,
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Mantenimiento de maquinaria · Repuestos
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Listado de repuestos
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta los repuestos disponibles para mantenimiento, su proveedor,
            costo unitario, estado y uso histórico en reparaciones.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/maintenance"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          {canManageSpareParts ? (
            <Link
              href="/dashboard/maintenance/spare-parts/new"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Registrar repuesto
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repuestos registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{spareParts.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total histórico de repuestos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeSpareParts.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Inactivos: {inactiveSpareParts.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Con proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sparePartsWithProvider.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sin proveedor: {sparePartsWithoutProvider.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usados en reparación</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {spareParts.reduce(
                (total, sparePart) =>
                  total + sparePart._count.detalle_repuesto_reparacion,
                0,
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Uso histórico en reparaciones.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repuestos registrados</CardTitle>
        </CardHeader>

        <CardContent>
          {spareParts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Aún no hay repuestos registrados.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Registra el primer repuesto para usarlo luego en reparaciones de
                maquinaria.
              </p>

              {canManageSpareParts ? (
                <Link
                  href="/dashboard/maintenance/spare-parts/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar primer repuesto
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Repuesto</th>
                    <th className="py-2 pr-3">Proveedor</th>
                    <th className="py-2 pr-3 text-right">Costo unitario</th>
                    <th className="py-2 pr-3 text-right">Usos</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    {canManageSpareParts ? (
                      <th className="py-2 text-right">Cambiar estado</th>
                    ) : null}
                  </tr>
                </thead>

                <tbody>
                  {spareParts.map((sparePart) => (
                    <tr key={sparePart.id_repuesto} className="border-b align-top">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {sparePart.id_repuesto}
                      </td>

                      <td className="py-2 pr-3 font-medium">
                        {sparePart.nombre_repuesto}
                        <p className="text-xs font-normal text-muted-foreground">
                          {sparePart.descripcion ?? "Sin descripción"}
                        </p>
                      </td>

                      <td className="py-2 pr-3">
                        {sparePart.proveedor?.razon_social ?? "-"}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatMoney(sparePart.costo_unitario)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {sparePart._count.detalle_repuesto_reparacion}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        <Badge variant={getStatusBadgeVariant(sparePart.estado)}>
                          {getStatusLabel(sparePart.estado)}
                        </Badge>
                      </td>

                      {canManageSpareParts ? (
                        <td className="py-2 text-right">
                          <form
                            action={updateSparePartStatusAction}
                            className="flex justify-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="id_repuesto"
                              value={sparePart.id_repuesto}
                            />

                            <select
                              name="estado"
                              defaultValue={String(sparePart.estado)}
                              className="rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                            >
                              <option value="true">Activo</option>
                              <option value="false">Inactivo</option>
                            </select>

                            <button
                              type="submit"
                              className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                            >
                              Guardar
                            </button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}