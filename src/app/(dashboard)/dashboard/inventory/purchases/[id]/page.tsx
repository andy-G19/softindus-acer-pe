import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { SupplierPaymentForm } from "@/components/inventory/supplier-payment-form";
import { annulPurchaseAction } from "@/modules/inventory/purchases/actions";

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

type PurchaseDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchaseDetailPage({
  params,
}: PurchaseDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const { id } = await params;

  const purchase = await prisma.compra.findUnique({
    where: {
      id_compra: id,
    },
  });

  if (!purchase) {
    redirect("/dashboard/inventory/purchases");
  }

  const [supplier, details, payments] = await Promise.all([
    prisma.proveedor.findUnique({
      where: {
        id_proveedor: purchase.id_proveedor,
      },
    }),
    prisma.detalle_compra.findMany({
      where: {
        id_compra: purchase.id_compra,
      },
      orderBy: {
        id_detalle_compra: "asc",
      },
    }),
    prisma.pago_proveedor.findMany({
      where: {
        id_compra: purchase.id_compra,
      },
      orderBy: {
        fecha_pago: "desc",
      },
    }),
  ]);

  const materialIds = details.map((detail) => detail.id_material);

  const materials = await prisma.material.findMany({
    where: {
      id_material: {
        in: materialIds,
      },
    },
  });

  const materialById = new Map(
    materials.map((material) => [material.id_material, material]),
  );

  const totalPaid = payments.reduce((acc, payment) => {
    return acc + Number(payment.monto_pagado.toString());
  }, 0);

  const purchaseTotal = Number(purchase.monto_total.toString());
  const saldoPendiente = purchaseTotal - totalPaid;
  const canPay = purchase.estado_compra !== "anulada" && saldoPendiente > 0;
  const canAnnul = purchase.estado_compra !== "anulada" && payments.length === 0;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Compras
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Compra {purchase.id_compra}
          </h1>
          <p className="text-slate-600">
            Detalle de compra, materiales adquiridos y pagos al proveedor.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/inventory/purchases"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Volver a compras
          </Link>
          {canAnnul ? (
            <form action={annulPurchaseAction}>
              <input type="hidden" name="id_compra" value={purchase.id_compra} />
              <button
                type="submit"
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Anular compra
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Proveedor</p>
          <p className="mt-2 font-semibold">
            {supplier?.razon_social ?? purchase.id_proveedor}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total compra</p>
          <p className="mt-2 text-2xl font-bold">
            {formatMoney(purchase.monto_total)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pagado</p>
          <p className="mt-2 text-2xl font-bold">S/ {totalPaid.toFixed(2)}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Saldo pendiente</p>
          <p className="mt-2 text-2xl font-bold">
            S/ {saldoPendiente.toFixed(2)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Datos de la compra</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <p className="text-sm">
            <span className="font-medium">Fecha:</span>{" "}
            {formatDate(purchase.fecha_compra)}
          </p>

          <p className="text-sm">
            <span className="font-medium">Comprobante:</span>{" "}
            {purchase.numero_comprobante
              ? `${purchase.tipo_comprobante ?? "-"} ${purchase.numero_comprobante}`
              : "-"}
          </p>

          <p className="text-sm">
            <span className="font-medium">Estado de pago:</span>{" "}
            {purchase.estado_pago}
          </p>

          <p className="text-sm">
            <span className="font-medium">Subtotal:</span>{" "}
            {formatMoney(purchase.subtotal)}
          </p>

          <p className="text-sm">
            <span className="font-medium">IGV:</span>{" "}
            {formatMoney(purchase.igv)}
          </p>

          <p className="text-sm">
            <span className="font-medium">Estado compra:</span>{" "}
            {purchase.estado_compra}
          </p>
        </div>

        {purchase.observaciones ? (
          <p className="mt-4 text-sm text-slate-600">
            <span className="font-medium">Observaciones:</span>{" "}
            {purchase.observaciones}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Materiales comprados</h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Cantidad</th>
              <th className="px-4 py-3 font-semibold">Unidad</th>
              <th className="px-4 py-3 font-semibold">Costo unitario</th>
              <th className="px-4 py-3 font-semibold">Subtotal</th>
            </tr>
          </thead>

          <tbody>
            {details.map((detail) => {
              const material = materialById.get(detail.id_material);

              return (
                <tr key={detail.id_detalle_compra} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {material?.nombre_material ?? detail.id_material}
                  </td>
                  <td className="px-4 py-3">
                    {Number(detail.cantidad.toString()).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">{detail.unidad_medida}</td>
                  <td className="px-4 py-3">
                    {formatMoney(detail.costo_unitario)}
                  </td>
                  <td className="px-4 py-3">{formatMoney(detail.subtotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {canPay ? (
        <SupplierPaymentForm
          idCompra={purchase.id_compra}
          saldoPendiente={saldoPendiente}
        />
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Historial de pagos</h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Monto</th>
              <th className="px-4 py-3 font-semibold">Método</th>
              <th className="px-4 py-3 font-semibold">Saldo posterior</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>

          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id_pago_proveedor} className="border-t">
                <td className="px-4 py-3">{formatDate(payment.fecha_pago)}</td>
                <td className="px-4 py-3">
                  {formatMoney(payment.monto_pagado)}
                </td>
                <td className="px-4 py-3">{payment.metodo_pago}</td>
                <td className="px-4 py-3">
                  {formatMoney(payment.saldo_pendiente)}
                </td>
                <td className="px-4 py-3">{payment.estado_pago}</td>
              </tr>
            ))}

            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay pagos registrados para esta compra.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
