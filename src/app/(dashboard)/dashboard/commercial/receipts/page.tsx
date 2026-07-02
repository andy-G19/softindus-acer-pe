import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/commercial/status-badge";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { annulReceiptAction } from "@/modules/commercial/receipts/actions";

type ReceiptsPageProps = {
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

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const type = parseStringParam(params, "type");
  const status = parseStringParam(params, "status");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const dateRange = buildDateRangeFilter(from, to);
  const filters: Prisma.comprobante_ventaWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { numero_comprobante: { contains: q, mode: "insensitive" } },
        { id_pedido: { contains: q, mode: "insensitive" } },
        {
          pedido: {
            cliente: {
              nombre_razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (type) {
    filters.push({ tipo_comprobante: type });
  }

  if (status) {
    filters.push({ estado: status });
  }

  if (dateRange) {
    filters.push({ fecha_emision: dateRange });
  }

  const receipts = await prisma.comprobante_venta.findMany({
    where: filters.length > 0 ? { AND: filters } : {},
    orderBy: {
      fecha_emision: "desc",
    },
    include: {
      pedido: {
        include: {
          cliente: true,
        },
      },
      proforma: true,
    },
  });

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">Comprobantes de venta</h1>
        <p className="text-sm text-muted-foreground">
          Consulta comprobantes emitidos y anulados.
        </p>
      </section>

      <form
        action="/dashboard/commercial/receipts"
        className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-5"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar comprobante..."
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          name="type"
          defaultValue={type}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los tipos</option>
          <option value="boleta">Boleta</option>
          <option value="factura">Factura</option>
          <option value="recibo">Recibo</option>
          <option value="otro">Otro</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="emitido">Emitido</option>
          <option value="anulado">Anulado</option>
        </select>
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
        <div className="flex gap-2 md:col-span-5">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Filtrar
          </button>
          <Link
            href="/dashboard/commercial/receipts"
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Limpiar filtros
          </Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Numero</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Pedido</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id_comprobante} className="border-t">
                <td className="px-4 py-3 font-medium">
                  {receipt.numero_comprobante}
                </td>
                <td className="px-4 py-3">
                  {receipt.pedido.cliente.nombre_razon_social}
                </td>
                <td className="px-4 py-3">{receipt.id_pedido}</td>
                <td className="px-4 py-3">{receipt.tipo_comprobante}</td>
                <td className="px-4 py-3">
                  {formatDate(receipt.fecha_emision)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(receipt.monto_total)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={receipt.estado} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {receipt.id_proforma ? (
                      <Link
                        href={`/dashboard/commercial/quotes/${receipt.id_proforma}`}
                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Ver proforma
                      </Link>
                    ) : null}
                    {receipt.estado !== "anulado" ? (
                      <form action={annulReceiptAction}>
                        <input
                          type="hidden"
                          name="id_comprobante"
                          value={receipt.id_comprobante}
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
            ))}
            {receipts.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavia no hay comprobantes registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
