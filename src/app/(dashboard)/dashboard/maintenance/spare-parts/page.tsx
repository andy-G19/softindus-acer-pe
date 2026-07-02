import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import { toggleSparePartStatusAction } from "@/modules/maintenance/spare-parts/actions";

type SparePartsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function getStatusFilter(status: string) {
  if (status === "active") {
    return true;
  }

  if (status === "inactive") {
    return false;
  }

  return undefined;
}

export default async function SparePartsPage({
  searchParams,
}: SparePartsPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const provider = getSearchParam(params, "provider");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.repuestoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_repuesto: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_repuesto: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (provider) {
    filters.push({
      id_proveedor: provider,
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.repuestoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [spareParts, providers] = await Promise.all([
    prisma.repuesto.findMany({
      where,
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
    }),
    prisma.proveedor.findMany({
      orderBy: {
        razon_social: "asc",
      },
      select: {
        id_proveedor: true,
        razon_social: true,
      },
    }),
  ]);

  const activeSpareParts = spareParts.filter((sparePart) => sparePart.estado);
  const inactiveSpareParts = spareParts.filter((sparePart) => !sparePart.estado);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Mantenimiento de maquinaria - Repuestos
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Listado de repuestos
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta repuestos disponibles para mantenimiento, proveedor, costo
            unitario, estado y uso historico en reparaciones.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/maintenance"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al modulo
          </Link>
          <Link
            href="/dashboard/maintenance/spare-parts/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Registrar repuesto
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repuestos registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{spareParts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeSpareParts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inactivos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{inactiveSpareParts.length}</p>
          </CardContent>
        </Card>
      </section>

      <form
        action="/dashboard/maintenance/spare-parts"
        className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar repuesto..."
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          name="provider"
          defaultValue={provider}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los proveedores</option>
          {providers.map((item) => (
            <option key={item.id_proveedor} value={item.id_proveedor}>
              {item.razon_social}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Filtrar
          </button>
          <Link
            href="/dashboard/maintenance/spare-parts"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Limpiar
          </Link>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repuestos registrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3">Codigo</th>
                  <th className="py-2 pr-3">Repuesto</th>
                  <th className="py-2 pr-3">Proveedor</th>
                  <th className="py-2 pr-3 text-right">Costo unitario</th>
                  <th className="py-2 pr-3 text-right">Usos</th>
                  <th className="py-2 pr-3 text-right">Estado</th>
                  <th className="py-2 text-right">Acciones</th>
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
                        {sparePart.descripcion ?? "Sin descripcion"}
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
                      <Badge variant={sparePart.estado ? "default" : "secondary"}>
                        {sparePart.estado ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/dashboard/maintenance/spare-parts/${sparePart.id_repuesto}/edit`}
                          className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                        >
                          Editar
                        </Link>
                        <form action={toggleSparePartStatusAction}>
                          <input
                            type="hidden"
                            name="id_repuesto"
                            value={sparePart.id_repuesto}
                          />
                          <button
                            type="submit"
                            className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                          >
                            {sparePart.estado ? "Inactivar" : "Activar"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {spareParts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Aun no hay repuestos registrados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
