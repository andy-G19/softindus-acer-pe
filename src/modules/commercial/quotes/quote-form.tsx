"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SubmitButton } from "@/components/forms/submit-button";
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
import { calculateQuoteAmounts, hasCents } from "@/lib/client-payment-amounts";
import { formatDate, formatMoney } from "@/lib/formatters";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { QuoteFormState } from "@/modules/commercial/quotes/actions";

type QuoteOrderItem = {
  id_detalle_pedido: string;
  producto: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
};

export type QuoteOrderOption = {
  id_pedido: string;
  cliente: string;
  fecha_pedido: string;
  fecha_entrega_estimada: string | null;
  monto_total: string;
  productos: QuoteOrderItem[];
};

type QuoteFormProps = {
  action: (prevState: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;
  orders: QuoteOrderOption[];
  defaultOrderId?: string;
  /**
   * Aviso que se da al guardar, del catalogo de Comercial. La pagina lo pasa con su clave literal
   * (commercialNotifications["quote-created"]) para que notification-registry.test.ts vea quien
   * emite la clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: QuoteFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const DISCARD = {
  title: "¿Descartar la proforma?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

// Formulario de la proforma nueva (C4 de la 11.3a, D27), en su pagina como crear compra. La
// accion devuelve un resultado: con error, el mensaje general queda en el formulario y cada error
// va junto a su campo; los campos toman lo enviado como defaultValue al remontarse (React 19
// reinicia el formulario tras la accion). Con exito hay un solo aviso, la clave de la operacion se
// renueva y se vuelve al listado con sus filtros. Con cambios, Cancelar pide confirmar.
export function QuoteForm({ action, orders, defaultOrderId, successNotification, returnTo }: QuoteFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

  const [selectedOrderId, setSelectedOrderId] = useState(() => {
    const exists = orders.some((order) => order.id_pedido === defaultOrderId);

    return exists ? defaultOrderId ?? "" : "";
  });
  const [advanceAmount, setAdvanceAmount] = useState("");

  const selectedOrder = useMemo(() => {
    return orders.find((order) => order.id_pedido === selectedOrderId) ?? null;
  }, [orders, selectedOrderId]);

  // C2 de la 11.3a: la vista previa usa la regla de la accion (client-payment-amounts.ts). Un
  // adelanto mayor que el total muestra saldo cero, como antes; la accion lo rechaza.
  const amounts = calculateQuoteAmounts({
    subtotals: [selectedOrder?.monto_total ?? 0],
    advance: advanceAmount || 0,
  });
  const balance = amounts.accepted ? amounts.balance : 0;
  const hasAdvance = hasCents(advanceAmount || 0);

  const canCreateQuote = orders.length > 0;
  const hasDefaultOrder = Boolean(defaultOrderId && selectedOrder);

  const notification = useMemo(
    () => (hasListFilters(returnTo) ? { ...successNotification, description: FILTER_HINT } : successNotification),
    [successNotification, returnTo],
  );
  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);
  const { controls, markDirty, trackFocus, discardDialog } = useDiscardGuard({ onLeave: goBack });

  // Mientras la accion esta pendiente, Cancelar no sale.
  useEffect(() => {
    controls.setBusy(pending);
  }, [controls, pending]);

  // Un aviso por operacion; tras guardar vuelve al listado sin preguntar.
  useFormResult(state, pending, { successNotification: notification, onSuccess: controls.closeAfterSave });

  // Un clic normal en Cancelar pasa por el descarte; con una tecla de modificador o la rueda,
  // el enlace abre el listado en otra pestana.
  function handleCancel(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    controls.requestClose();
  }

  return (
    <>
      <ActionForm
        action={formAction}
        pending={pending}
        resultKey={resultKey}
        className="space-y-5 rounded-lg border border-border/80 bg-card p-6"
        onInput={() => markDirty(true)}
        onFocus={trackFocus}
      >
        <OperationKeyField scope="proforma:nueva" completedKey={completedKey} />

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {!canCreateQuote && (
          <Alert variant="warning">
            <AlertDescription>
              No existen pedidos disponibles para generar proforma. Primero registra un pedido o verifica
              que el pedido no tenga ya una proforma vigente.
            </AlertDescription>
          </Alert>
        )}
        {hasDefaultOrder && (
          <Alert variant="success">
            <AlertDescription>Pedido preseleccionado correctamente desde el listado de pedidos.</AlertDescription>
          </Alert>
        )}

        <Field id="id_pedido" label="Pedido" required disabled={!canCreateQuote} errors={fieldErrors?.id_pedido}>
          {(control) => (
            // Dentro de ActionForm un select usa defaultValue con su onChange: React 19 reinicia el
            // formulario tras la accion y uno controlado volveria a su primera opcion (CLAUDE.md).
            // El estado ya guarda lo enviado, asi que la lista y el resumen del pedido no divergen.
            <NativeSelect
              {...control}
              name="id_pedido"
              defaultValue={selectedOrderId}
              onChange={(event) => setSelectedOrderId(event.target.value)}
            >
              <option value="">Selecciona un pedido</option>

              {orders.map((order) => (
                <option key={order.id_pedido} value={order.id_pedido}>
                  {order.id_pedido} — {order.cliente} — {formatMoney(order.monto_total)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        {selectedOrder && (
          <div className="space-y-4 rounded-lg border border-border/80 bg-muted/30 p-4">
            <div>
              <h2 className="font-semibold">Resumen del pedido</h2>
              <p className="text-sm text-muted-foreground">Revisa los datos antes de generar la proforma.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border/80 bg-background p-3">
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium">{selectedOrder.cliente}</p>
              </div>

              <div className="rounded-lg border border-border/80 bg-background p-3">
                <p className="text-xs text-muted-foreground">Fecha de pedido</p>
                <p className="font-medium">{formatDate(selectedOrder.fecha_pedido)}</p>
              </div>

              <div className="rounded-lg border border-border/80 bg-background p-3">
                <p className="text-xs text-muted-foreground">Entrega estimada</p>
                <p className="font-medium">{formatDate(selectedOrder.fecha_entrega_estimada)}</p>
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
                <p className="text-2xl font-bold">{formatMoney(selectedOrder.monto_total)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field
            id="adelanto_inicial"
            label="Adelanto inicial"
            description="Opcional. Si no hay adelanto, déjalo vacío."
            disabled={!canCreateQuote}
            errors={fieldErrors?.adelanto_inicial}
          >
            {(control) => (
              <Input
                {...control}
                name="adelanto_inicial"
                type="number"
                min="0"
                step="0.01"
                defaultValue={values?.adelanto_inicial ?? advanceAmount}
                onChange={(event) => setAdvanceAmount(event.target.value)}
                placeholder="Ejemplo: 100.00"
              />
            )}
          </Field>

          <Field
            id="metodo_pago_adelanto"
            label="Método de pago del adelanto"
            description={
              hasAdvance
                ? "El adelanto se registra como pago y aparecerá en el historial."
                : "Se habilita al ingresar un adelanto."
            }
            required={hasAdvance}
            disabled={!canCreateQuote || !hasAdvance}
            errors={fieldErrors?.metodo_pago_adelanto}
          >
            {(control) => (
              <NativeSelect
                {...control}
                name="metodo_pago_adelanto"
                defaultValue={values?.metodo_pago_adelanto ?? ""}
              >
                <option value="">Seleccione...</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="otro">Otro</option>
              </NativeSelect>
            )}
          </Field>

          <div className="space-y-2">
            <Label>Saldo calculado</Label>
            <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm font-medium">
              {formatMoney(balance)}
            </div>
            <p className="text-xs text-muted-foreground">Se calcula como total menos adelanto.</p>
          </div>

          <Field
            id="validez_dias"
            label="Validez en días"
            description="Opcional. Ejemplo: 7, 15 o 30 días."
            disabled={!canCreateQuote}
            errors={fieldErrors?.validez_dias}
          >
            {(control) => (
              <Input
                {...control}
                name="validez_dias"
                type="number"
                min="1"
                step="1"
                defaultValue={values?.validez_dias ?? ""}
                placeholder="Ejemplo: 15"
              />
            )}
          </Field>
        </div>

        <Field id="observaciones" label="Observaciones" disabled={!canCreateQuote} errors={fieldErrors?.observaciones}>
          {(control) => (
            <Textarea
              {...control}
              name="observaciones"
              defaultValue={values?.observaciones ?? ""}
              placeholder="Ejemplo: Proforma válida hasta agotar stock. Precio sujeto a confirmación."
              className="min-h-24"
            />
          )}
        </Field>

        <div className="flex items-center gap-3">
          <SubmitButton pendingText="Generando..." disabled={!canCreateQuote}>
            Generar proforma
          </SubmitButton>

          <Button variant="outline" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
