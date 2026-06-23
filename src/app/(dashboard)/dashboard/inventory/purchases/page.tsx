import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

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

export default async function PurchasesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/access-denied");
  }

  const purchases = await prisma.compra.findMany({
    orderBy: {
      fecha_registro: "desc",
    },
  });

  const supplierIds = [...new Set(purchases.map((purchase) => purchase.id_proveedor))];

  const suppliers = await prisma.proveedor.findMany({
    where: {
      id_proveedor: {
        in: supplierIds,
      },
    },
  });

  const supplierById = new Map(
    suppliers.map((supplier) => [supplier.id_proveedor, supplier]),
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Compras
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Compras</h1>
          <p className="text-slate-600">
            Consulta compras registradas y entradas generadas en inventario.
          </p>
        </div>

        <Link
          href="/dashboard/inventory/purchases/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva compra
        </Link>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Proveedor</th>
              <th className="px-4 py-3 font-semibold">Comprobante</th>
              <th className="px-4 py-3 font-semibold">Subtotal</th>
              <th className="px-4 py-3 font-semibold">IGV</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Pago</th>
              <th className="px-4 py-3 font-semibold">Estado compra</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {purchases.map((purchase) => {
              const supplier = supplierById.get(purchase.id_proveedor);

              return (
                <tr key={purchase.id_compra} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {purchase.id_compra}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(purchase.fecha_compra)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {supplier?.razon_social ?? purchase.id_proveedor}
                  </td>
                  <td className="px-4 py-3">
                    {purchase.numero_comprobante
                      ? `${purchase.tipo_comprobante ?? "-"} ${purchase.numero_comprobante}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">{formatMoney(purchase.subtotal)}</td>
                  <td className="px-4 py-3">{formatMoney(purchase.igv)}</td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(purchase.monto_total)}
                  </td>
                  <td className="px-4 py-3">{purchase.estado_pago}</td>
                  <td className="px-4 py-3">{purchase.estado_compra}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/inventory/purchases/${purchase.id_compra}`}
                      className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              );
            })}

            {purchases.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay compras registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}