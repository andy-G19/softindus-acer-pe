"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
  const hasAdvance = advance > 0;

  const canCreateQuote = orders.length > 0;
  const hasDefaultOrder = Boolean(defaultOrderId && selectedOrder);

  return (
    <form
      action={createQuoteAction}
      className="space-y-5 rounded-lg border border-border/80 bg-card p-6"
    >
      {!canCreateQuote && (
        <Alert variant="warning">
          <AlertDescription>
            No existen pedidos disponibles para generar proforma. Primero
            registra un pedido o verifica que el pedido no tenga ya una
            proforma vigente.
          </AlertDescription>
        </Alert>
      )}
      {hasDefaultOrder && (
        <Alert variant="success">
          <AlertDescription>
            Pedido preseleccionado correctamente desde el listado de pedidos.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Pedido</Label>
        <NativeSelect
          name="id_pedido"
          value={selectedOrderId}
          onChange={(event) => setSelectedOrderId(event.target.value)}
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
        </NativeSelect>
      </div>

      {selectedOrder && (
        <div className="space-y-4 rounded-lg border border-border/80 bg-muted/30 p-4">
          <div>
            <h2 className="font-semibold">Resumen del pedido</h2>
            <p className="text-sm text-muted-foreground">
              Revisa los datos antes de generar la proforma.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border/80 bg-background p-3">
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">{selectedOrder.cliente}</p>
            </div>

            <div className="rounded-lg border border-border/80 bg-background p-3">
              <p className="text-xs text-muted-foreground">Fecha de pedido</p>
              <p className="font-medium">
                {formatDate(selectedOrder.fecha_pedido)}
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-background p-3">
              <p className="text-xs text-muted-foreground">Entrega estimada</p>
              <p className="font-medium">
                {formatDate(selectedOrder.fecha_entrega_estimada)}
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Precio unitario</TableHead>
                <TableHead>Subtotal</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {selectedOrder.productos.map((item) => (
                <TableRow key={item.id_detalle_pedido}>
                  <TableCell>{item.producto}</TableCell>
                  <TableCell>{Number(item.cantidad).toFixed(2)}</TableCell>
                  <TableCell>{formatMoney(item.precio_unitario)}</TableCell>
                  <TableCell>{formatMoney(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Adelanto inicial</Label>
          <Input
            name="adelanto_inicial"
            type="number"
            min="0"
            step="0.01"
            value={advanceAmount}
            onChange={(event) => setAdvanceAmount(event.target.value)}
            placeholder="Ejemplo: 100.00"
            disabled={!canCreateQuote}
          />
          <p className="text-xs text-muted-foreground">
            Opcional. Si no hay adelanto, déjalo vacío.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Método de pago del adelanto</Label>
          <NativeSelect
            name="metodo_pago_adelanto"
            required={hasAdvance}
            disabled={!canCreateQuote || !hasAdvance}
          >
            <option value="">Seleccione...</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="yape">Yape</option>
            <option value="plin">Plin</option>
            <option value="otro">Otro</option>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            {hasAdvance
              ? "El adelanto se registra como pago y aparecerá en el historial."
              : "Se habilita al ingresar un adelanto."}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Saldo calculado</Label>
          <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm font-medium">
            {formatMoney(balance)}
          </div>
          <p className="text-xs text-muted-foreground">
            Se calcula como total menos adelanto.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Validez en días</Label>
          <Input
            name="validez_dias"
            type="number"
            min="1"
            step="1"
            placeholder="Ejemplo: 15"
            disabled={!canCreateQuote}
          />
          <p className="text-xs text-muted-foreground">
            Opcional. Ejemplo: 7, 15 o 30 días.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observaciones</Label>
        <Textarea
          name="observaciones"
          placeholder="Ejemplo: Proforma válida hasta agotar stock. Precio sujeto a confirmación."
          className="min-h-24"
          disabled={!canCreateQuote}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canCreateQuote}>
          Generar proforma
        </Button>

        <Button variant="outline" asChild>
          <Link href="/dashboard/commercial/quotes">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}