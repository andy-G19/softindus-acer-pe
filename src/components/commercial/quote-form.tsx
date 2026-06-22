"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { createQuoteAction } from "@/modules/commercial/quotes/actions";

type QuoteOrderItem = {
  id_detalle_pedido: string;
  producto: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
};

type QuoteOrderOption = {
  id_pedido: string;
  cliente: string;
  fecha_pedido: string;
  fecha_entrega_estimada: string | null;
  monto_total: string;
  productos: QuoteOrderItem[];
};

type QuoteFormProps = {
  orders: QuoteOrderOption[];
  defaultOrderId?: string;
};

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "S/ 0.00";
  }

  return `S/ ${Number(value).toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

export function QuoteForm({ orders, defaultOrderId }: QuoteFormProps) {
  const [selectedOrderId, setSelectedOrderId] = useState(() => {
    const exists = orders.some((order) => order.id_pedido === defaultOrderId);

    return exists ? defaultOrderId ?? "" : "";
  });
  const [advanceAmount, setAdvanceAmount] = useState("");

  const selectedOrder = useMemo(() => {
    return orders.find((order) => order.id_pedido === selectedOrderId) ?? null;
  }, [orders, selectedOrderId]);

  const totalAmount = Number(selectedOrder?.monto_total ?? 0);
  const advance = Number(advanceAmount || 0);
  const balance = Math.max(totalAmount - advance, 0);

  const canCreateQuote = orders.length > 0;
  const hasDefaultOrder = Boolean(defaultOrderId && selectedOrder);

  return (
    <form action={createQuoteAction} className="space-y-5 rounded-lg border p-6">
      {!canCreateQuote && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          No existen pedidos disponibles para generar proforma. Primero registra
          un pedido o verifica que el pedido no tenga ya una proforma vigente.
        </div>
      )}
      {hasDefaultOrder && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
            Pedido preseleccionado correctamente desde el listado de pedidos.
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Pedido</label>
        <select
          name="id_pedido"
          value={selectedOrderId}
          onChange={(event) => setSelectedOrderId(event.target.value)}
          className="w-full rounded-md border px-3 py-2"
          required
          disabled={!canCreateQuote}
        >
          <option value="">Selecciona un pedido</option>

          {orders.map((order) => (
            <option key={order.id_pedido} value={order.id_pedido}>
              {order.id_pedido} — {order.cliente} —{" "}
              {formatMoney(order.monto_total)}
            </option>
          ))}
        </select>
      </div>

      {selectedOrder && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div>
            <h2 className="font-semibold">Resumen del pedido</h2>
            <p className="text-sm text-muted-foreground">
              Revisa los datos antes de generar la proforma.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">{selectedOrder.cliente}</p>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Fecha de pedido</p>
              <p className="font-medium">
                {formatDate(selectedOrder.fecha_pedido)}
              </p>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Entrega estimada</p>
              <p className="font-medium">
                {formatDate(selectedOrder.fecha_entrega_estimada)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">Cantidad</th>
                  <th className="px-4 py-3 text-left">Precio unitario</th>
                  <th className="px-4 py-3 text-left">Subtotal</th>
                </tr>
              </thead>

              <tbody>
                {selectedOrder.productos.map((item) => (
                  <tr key={item.id_detalle_pedido} className="border-t">
                    <td className="px-4 py-3">{item.producto}</td>
                    <td className="px-4 py-3">
                      {Number(item.cantidad).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(item.precio_unitario)}
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Monto total</p>
              <p className="text-2xl font-bold">
                {formatMoney(selectedOrder.monto_total)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Adelanto inicial</label>
          <input
            name="adelanto_inicial"
            type="number"
            min="0"
            step="0.01"
            value={advanceAmount}
            onChange={(event) => setAdvanceAmount(event.target.value)}
            placeholder="Ejemplo: 100.00"
            className="w-full rounded-md border px-3 py-2"
            disabled={!canCreateQuote}
          />
          <p className="text-xs text-muted-foreground">
            Opcional. Si no hay adelanto, déjalo vacío.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Saldo calculado</label>
          <div className="rounded-md border bg-muted px-3 py-2 text-sm font-medium">
            {formatMoney(balance)}
          </div>
          <p className="text-xs text-muted-foreground">
            Se calcula como total menos adelanto.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Validez en días</label>
          <input
            name="validez_dias"
            type="number"
            min="1"
            step="1"
            placeholder="Ejemplo: 15"
            className="w-full rounded-md border px-3 py-2"
            disabled={!canCreateQuote}
          />
          <p className="text-xs text-muted-foreground">
            Opcional. Ejemplo: 7, 15 o 30 días.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Observaciones</label>
        <textarea
          name="observaciones"
          placeholder="Ejemplo: Proforma válida hasta agotar stock. Precio sujeto a confirmación."
          className="min-h-24 w-full rounded-md border px-3 py-2"
          disabled={!canCreateQuote}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canCreateQuote}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generar proforma
        </button>

        <Link
          href="/dashboard/commercial/quotes"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}