import Link from "next/link";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type OutputsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function formatDate(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

export default async function InventoryOutputsPage({
  searchParams,
}: OutputsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "WORKSHOP_MASTER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const material = parseStringParam(params, "material");
  const order = parseStringParam(params, "order");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );
  const filters: Prisma.movimiento_inventarioWhereInput[] = [
    { tipo_movimiento: "salida" },
  ];

  if (q) {
    filters.push({
      OR: [
        { id_orden_trabajo: { contains: q, mode: "insensitive" } },
        { material: { nombre_material: { contains: q, mode: "insensitive" } } },
        { usuario: { usuario: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (material) {
    filters.push({ id_material: material });
  }

  if (order) {
    filters.push({ id_orden_trabajo: order });
  }

  if (dateRange) {
    filters.push({ fecha_movimiento: dateRange });
  }

  const [movements, materials, workOrders] = await Promise.all([
    prisma.movimiento_inventario.findMany({
      where: { AND: filters },
      orderBy: { fecha_movimiento: "desc" },
      include: {
        material: true,
        usuario: true,
      },
    }),
    prisma.material.findMany({
      orderBy: { nombre_material: "asc" },
      select: { id_material: true, nombre_material: true },
    }),
    prisma.orden_trabajo.findMany({
      orderBy: { fecha_inicio: "desc" },
      select: { id_orden_trabajo: true },
    }),
  ]);

  return (
    <main className="space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Salidas de inventario</h1>
          <p className="text-sm text-muted-foreground">
            Movimientos de salida asociados a producción u otros motivos.
          </p>
        </div>
        <Link
          href="/dashboard/inventory/outputs/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Registrar salida
        </Link>
      </section>

      <form
        action="/dashboard/inventory/outputs"
        className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-5"
      >
        <input name="q" defaultValue={q} placeholder="Buscar salida..." className="rounded-md border px-3 py-2 text-sm" />
        <select name="material" defaultValue={material} className="rounded-md border px-3 py-2 text-sm">
          <option value="">Todos los materiales</option>
          {materials.map((item) => <option key={item.id_material} value={item.id_material}>{item.nombre_material}</option>)}
        </select>
        <select name="order" defaultValue={order} className="rounded-md border px-3 py-2 text-sm">
          <option value="">Todas las ordenes</option>
          {workOrders.map((item) => <option key={item.id_orden_trabajo} value={item.id_orden_trabajo}>{item.id_orden_trabajo}</option>)}
        </select>
        <input name="from" type="date" defaultValue={parseStringParam(params, "from")} className="rounded-md border px-3 py-2 text-sm" />
        <input name="to" type="date" defaultValue={parseStringParam(params, "to")} className="rounded-md border px-3 py-2 text-sm" />
        <div className="flex gap-2 md:col-span-5">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Filtrar</button>
          <Link href="/dashboard/inventory/outputs" className="rounded-md border px-4 py-2 text-sm font-medium">Limpiar filtros</Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Codigo</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Material</th>
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3">Responsable</th>
              <th className="px-4 py-3 text-right">Cantidad</th>
              <th className="px-4 py-3 text-right">Stock resultante</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id_movimiento} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{movement.id_movimiento}</td>
                <td className="px-4 py-3">{formatDate(movement.fecha_movimiento)}</td>
                <td className="px-4 py-3">{movement.material.nombre_material}</td>
                <td className="px-4 py-3">{movement.id_orden_trabajo ?? "-"}</td>
                <td className="px-4 py-3">{movement.usuario.usuario}</td>
                <td className="px-4 py-3 text-right">{Number(movement.cantidad.toString()).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{Number(movement.stock_resultante.toString()).toFixed(2)}</td>
                <td className="px-4 py-3">{movement.id_orden_trabajo ? <Link href={`/dashboard/production/work-orders/${movement.id_orden_trabajo}`} className="rounded-md border px-3 py-1.5 text-xs font-medium">Ver orden</Link> : "-"}</td>
              </tr>
            ))}
            {movements.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Todavia no hay salidas registradas.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
