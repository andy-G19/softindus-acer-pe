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
import { annulPurchaseAction } from "@/modules/inventory/purchases/actions";

type PurchasesPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const supplier = parseStringParam(params, "supplier");
  const material = parseStringParam(params, "material");
  const purchaseStatus = parseStringParam(params, "status");
  const paymentStatus = parseStringParam(params, "payment");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );
  const filters: Prisma.compraWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_compra: { contains: q, mode: "insensitive" } },
        { numero_comprobante: { contains: q, mode: "insensitive" } },
        {
          proveedor: {
            razon_social: { contains: q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (supplier) {
    filters.push({ id_proveedor: supplier });
  }

  if (material) {
    filters.push({
      detalle_compra: {
        some: {
          id_material: material,
        },
      },
    });
  }

  if (purchaseStatus) {
    filters.push({ estado_compra: purchaseStatus });
  }

  if (paymentStatus) {
    filters.push({ estado_pago: paymentStatus });
  }

  if (dateRange) {
    filters.push({ fecha_compra: dateRange });
  }

  const [purchases, suppliers, materials] = await Promise.all([
    prisma.compra.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        proveedor: true,
        pago_proveedor: {
          select: {
            id_pago_proveedor: true,
          },
        },
        movimiento_inventario: {
          select: {
            id_movimiento: true,
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
    prisma.material.findMany({
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario - Compras
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Compras</h1>
          <p className="text-slate-600">
            Consulta compras registradas, pagos y entradas generadas.
          </p>
        </div>

        <Link
          href="/dashboard/inventory/purchases/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva compra
        </Link>
      </section>

      <form
        action="/dashboard/inventory/purchases"
        className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-6"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar compra..."
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          name="supplier"
          defaultValue={supplier}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los proveedores</option>
          {suppliers.map((item) => (
            <option key={item.id_proveedor} value={item.id_proveedor}>
              {item.razon_social}
            </option>
          ))}
        </select>
        <select
          name="material"
          defaultValue={material}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los materiales</option>
          {materials.map((item) => (
            <option key={item.id_material} value={item.id_material}>
              {item.nombre_material}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={purchaseStatus}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Estado compra</option>
          <option value="registrada">Registrada</option>
          <option value="confirmada">Confirmada</option>
          <option value="anulada">Anulada</option>
        </select>
        <select
          name="payment"
          defaultValue={paymentStatus}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Estado pago</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="pagado">Pagado</option>
          <option value="anulada">Anulada</option>
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="from"
            type="date"
            defaultValue={parseStringParam(params, "from")}
            className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <input
            name="to"
            type="date"
            defaultValue={parseStringParam(params, "to")}
            className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <div className="flex gap-2 md:col-span-6">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Filtrar
          </button>
          <Link
            href="/dashboard/inventory/purchases"
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Limpiar filtros
          </Link>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Codigo</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Proveedor</th>
              <th className="px-4 py-3 font-semibold">Comprobante</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Pago</th>
              <th className="px-4 py-3 font-semibold">Estado compra</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => {
              const canAnnul =
                purchase.estado_compra !== "anulada" &&
                purchase.pago_proveedor.length === 0 &&
                purchase.movimiento_inventario.length > 0;

              return (
                <tr key={purchase.id_compra} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {purchase.id_compra}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(purchase.fecha_compra)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {purchase.proveedor.razon_social}
                  </td>
                  <td className="px-4 py-3">
                    {purchase.numero_comprobante
                      ? `${purchase.tipo_comprobante ?? "-"} ${purchase.numero_comprobante}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(purchase.monto_total)}
                  </td>
                  <td className="px-4 py-3">{purchase.estado_pago}</td>
                  <td className="px-4 py-3">{purchase.estado_compra}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/inventory/purchases/${purchase.id_compra}`}
                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Ver detalle
                      </Link>
                      {canAnnul ? (
                        <form action={annulPurchaseAction}>
                          <input
                            type="hidden"
                            name="id_compra"
                            value={purchase.id_compra}
                          />
                          <button
                            type="submit"
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            Anular
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}

            {purchases.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Todavia no hay compras registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
