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

type SupplierPaymentsPageProps = {
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

export default async function SupplierPaymentsPage({
  searchParams,
}: SupplierPaymentsPageProps) {
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
  const purchase = parseStringParam(params, "purchase");
  const method = parseStringParam(params, "method");
  const status = parseStringParam(params, "status");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );
  const filters: Prisma.pago_proveedorWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_compra: { contains: q, mode: "insensitive" } },
        {
          compra: {
            numero_comprobante: { contains: q, mode: "insensitive" },
          },
        },
        {
          compra: {
            proveedor: {
              razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (supplier) {
    filters.push({ id_proveedor: supplier });
  }

  if (purchase) {
    filters.push({ id_compra: purchase });
  }

  if (method) {
    filters.push({ metodo_pago: method });
  }

  if (status) {
    filters.push({ estado_pago: status });
  }

  if (dateRange) {
    filters.push({ fecha_pago: dateRange });
  }

  const [payments, suppliers, purchases] = await Promise.all([
    prisma.pago_proveedor.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      orderBy: {
        fecha_pago: "desc",
      },
      include: {
        compra: {
          include: {
            proveedor: true,
          },
        },
        usuario: true,
      },
    }),
    prisma.proveedor.findMany({
      orderBy: { razon_social: "asc" },
      select: { id_proveedor: true, razon_social: true },
    }),
    prisma.compra.findMany({
      orderBy: { fecha_compra: "desc" },
      select: { id_compra: true },
    }),
  ]);

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">Pagos a proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Consulta pagos registrados desde compras.
        </p>
      </section>

      <form
        action="/dashboard/inventory/supplier-payments"
        className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-6"
      >
        <input name="q" defaultValue={q} placeholder="Buscar pago..." className="rounded-md border px-3 py-2 text-sm" />
        <select name="supplier" defaultValue={supplier} className="rounded-md border px-3 py-2 text-sm">
          <option value="">Todos los proveedores</option>
          {suppliers.map((item) => <option key={item.id_proveedor} value={item.id_proveedor}>{item.razon_social}</option>)}
        </select>
        <select name="purchase" defaultValue={purchase} className="rounded-md border px-3 py-2 text-sm">
          <option value="">Todas las compras</option>
          {purchases.map((item) => <option key={item.id_compra} value={item.id_compra}>{item.id_compra}</option>)}
        </select>
        <select name="method" defaultValue={method} className="rounded-md border px-3 py-2 text-sm">
          <option value="">Metodo</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="yape">Yape</option>
          <option value="plin">Plin</option>
          <option value="otro">Otro</option>
        </select>
        <select name="status" defaultValue={status} className="rounded-md border px-3 py-2 text-sm">
          <option value="">Estado pago</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="pagado">Pagado</option>
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="from" type="date" defaultValue={parseStringParam(params, "from")} className="rounded-md border px-3 py-2 text-sm" />
          <input name="to" type="date" defaultValue={parseStringParam(params, "to")} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2 md:col-span-6">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Filtrar</button>
          <Link href="/dashboard/inventory/supplier-payments" className="rounded-md border px-4 py-2 text-sm font-medium">Limpiar filtros</Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Compra</th>
              <th className="px-4 py-3">Metodo</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id_pago_proveedor} className="border-t">
                <td className="px-4 py-3">{formatDate(payment.fecha_pago)}</td>
                <td className="px-4 py-3">{payment.compra.proveedor.razon_social}</td>
                <td className="px-4 py-3">{payment.id_compra}</td>
                <td className="px-4 py-3">{payment.metodo_pago}</td>
                <td className="px-4 py-3 text-right">{formatMoney(payment.monto_pagado)}</td>
                <td className="px-4 py-3 text-right">{formatMoney(payment.saldo_pendiente)}</td>
                <td className="px-4 py-3">{payment.estado_pago}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/inventory/purchases/${payment.id_compra}`} className="rounded-md border px-3 py-1.5 text-xs font-medium">Ver compra</Link>
                </td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Todavia no hay pagos a proveedores.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
