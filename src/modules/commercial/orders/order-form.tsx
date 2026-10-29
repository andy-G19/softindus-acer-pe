"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/formatters";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { calculateOrderAmounts } from "@/lib/order-amounts";
import type {
  OrderFormState,
  OrderFormValues,
  OrderLineValues,
} from "@/modules/commercial/orders/actions";

type ClientOption = {
  id_cliente: string;
  nombre_razon_social: string;
  tipo_cliente: string;
  /** Cliente actual del pedido que se edita, inactivo: se marca en la lista. */
  inactivo?: boolean;
};

type ProductOption = {
  id_producto: string;
  nombre_producto: string;
  categoria: string;
  unidad_medida: string;
  precio_referencial: string | null;
  /** Producto actual del pedido que se edita, inactivo: se marca en la lista. */
  inactivo?: boolean;
};

type OrderItem = OrderLineValues & { key: string };

type OrderFormProps = {
  action: (prevState: OrderFormState, formData: FormData) => Promise<OrderFormState>;
  clients: ClientOption[];
  products: ProductOption[];
  /** Valores del pedido que se edita; en el alta, vacios. */
  defaultValues?: Partial<OrderFormValues> & { id_pedido?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Comercial. La pagina lo pasa
   * con su clave literal (commercialNotifications["order-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: OrderFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

// Confirmacion de descarte del alta y de la edicion.
const DISCARD_NEW = {
  title: "¿Descartar el pedido nuevo?",
  description: "Se perderán los datos que escribiste en este formulario.",
};
const DISCARD_EDIT = {
  title: "¿Descartar los cambios del pedido?",
  description: "Se perderán los cambios que hiciste en este formulario.",
};

function createEmptyItem(key: string): OrderItem {
  return {
    key,
    id_producto: "",
    cantidad: "1",
    precio_unitario: "",
    observacion_detalle: "",
  };
}

// Formulario de alta y edicion de pedidos (entrega 10.4c), la superficie
// amplia de Comercial: una pagina completa, no un panel. La accion devuelve un
// resultado: con error, el mensaje general queda dentro del formulario, sin
// toast; cada error va junto a su campo, tambien los de una linea
// (items.<linea>.<campo>), y ActionForm enfoca el primero; con exito, se da un
// solo aviso y se vuelve al listado con sus filtros.
//
// Las lineas, el cliente elegido y las cantidades y precios son estado del
// formulario: sobreviven al resultado de la accion, que remonta los campos
// (ActionForm) para que la fecha y las observaciones tomen lo enviado. Los ids
// de una linea llevan su key (useId cambiaria con los hermanos, y la posicion
// cambia al quitar una linea). El subtotal y el total usan la regla con que se
// guardan (src/lib/order-amounts.ts).
//
// Descarte (D4 de la 10.4): con cambios, Cancelar pide confirmar y recargar o
// cerrar la pestana lo pregunta el navegador (useDiscardGuard). Un cambio es
// escribir en un campo (el evento input) o lo que no lo dispara: elegir o
// limpiar un cliente o un producto, agregar o quitar una linea. Atras y los
// enlaces del menu no se bloquean: se decide antes de la entrega 11.
export function OrderForm({
  action,
  clients,
  products,
  defaultValues,
  submitLabel,
  successNotification,
  returnTo,
}: OrderFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const fecha = state.status === "idle" ? defaultValues?.fecha_entrega_estimada ?? "" : state.values.fecha_entrega_estimada;
  const observaciones = state.status === "idle" ? defaultValues?.observaciones ?? "" : state.values.observaciones;

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

  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const initialItems = defaultValues?.items?.length
    ? defaultValues.items.map((item, index) => ({
        key: `row-${index + 1}`,
        ...item,
      }))
    : [createEmptyItem("row-1")];
  const [nextKey, setNextKey] = useState(initialItems.length + 1);
  const [selectedClient, setSelectedClient] = useState(
    defaultValues?.id_cliente ?? "",
  );
  const [items, setItems] = useState<OrderItem[]>(initialItems);

  const canCreateOrder = clients.length > 0 && products.length > 0;

  const clientItems = useMemo(() => {
    return clients.map((client) => ({
      id: client.id_cliente,
      label: client.nombre_razon_social,
      description: client.inactivo ? `${client.tipo_cliente} - Inactivo` : client.tipo_cliente,
    }));
  }, [clients]);

  const productItems = useMemo(() => {
    return products.map((product) => ({
      id: product.id_producto,
      label: product.nombre_producto,
      description: `${product.categoria} - ${product.unidad_medida} - ${formatMoney(
        product.precio_referencial,
        { emptyText: "Sin precio" },
      )}${product.inactivo ? " - Inactivo" : ""}`,
    }));
  }, [products]);

  // Vista previa con la misma regla que guarda la accion (src/lib/order-amounts.ts).
  const amounts = useMemo(() => calculateOrderAmounts(items), [items]);

  function errorsOf(key: string) {
    return fieldErrors?.[key];
  }

  // Props de error de un campo que no pasa por Field (las busquedas).
  function errorProps(key: string, id: string) {
    return errorsOf(key)?.length
      ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` }
      : {};
  }

  function selectClient(clientId: string) {
    setSelectedClient(clientId);
    markDirty(true);
  }

  // Un clic normal en Cancelar pasa por el descarte; con una tecla de
  // modificador o la rueda, el enlace abre el listado en otra pestana.
  function handleCancel(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    controls.requestClose();
  }

  function addItem() {
    markDirty(true);
    setItems((currentItems) => [
      ...currentItems,
      createEmptyItem(`row-${nextKey}`),
    ]);

    setNextKey((currentKey) => currentKey + 1);
  }

  function removeItem(key: string) {
    if (items.length > 1) {
      markDirty(true);
    }

    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems;
      }

      return currentItems.filter((item) => item.key !== key);
    });
  }

  function updateItem(key: string, field: keyof OrderLineValues, value: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.key !== key) {
          return item;
        }

        return {
          ...item,
          [field]: value,
        };
      }),
    );
  }

  function handleProductChange(key: string, productId: string) {
    const selectedProduct = products.find(
      (product) => product.id_producto === productId,
    );

    markDirty(true);

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.key !== key) {
          return item;
        }

        return {
          ...item,
          id_producto: productId,
          precio_unitario: selectedProduct?.precio_referencial ?? "",
        };
      }),
    );
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
        {defaultValues?.id_pedido ? (
          <input type="hidden" name="id_pedido" value={defaultValues.id_pedido} />
        ) : null}

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {!canCreateOrder && (
          <Alert variant="warning">
            <AlertDescription>
              Para registrar un pedido necesitas tener al menos un cliente
              activo y un producto activo.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <SearchableSelect
            id="id_cliente"
            name="id_cliente"
            label="Cliente"
            placeholder="Buscar cliente..."
            items={clientItems}
            required
            disabled={!canCreateOrder}
            value={selectedClient}
            onValueChange={selectClient}
            emptyMessage="No hay clientes activos."
            {...errorProps("id_cliente", "id_cliente")}
          />
          <FieldError id="id_cliente-error" messages={errorsOf("id_cliente")} />
        </div>

        <div className="space-y-4 rounded-lg border border-border/80 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Detalle del pedido</h2>
              <p className="text-xs text-muted-foreground">
                Puedes agregar varios productos al mismo pedido.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              disabled={!canCreateOrder}
            >
              Agregar producto
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => {
              const { subtotal } = amounts.lines[index];
              const line = `items.${index}`;

              return (
                <div
                  key={item.key}
                  className="rounded-lg border border-border/80 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Producto {index + 1}
                    </h3>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.key)}
                      disabled={items.length === 1}
                      className="text-destructive hover:text-destructive"
                    >
                      Quitar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <SearchableSelect
                      id={`id_producto-${item.key}`}
                      name="id_producto"
                      label="Producto"
                      placeholder="Buscar producto..."
                      items={productItems}
                      value={item.id_producto}
                      required
                      disabled={!canCreateOrder}
                      emptyMessage="No hay productos activos."
                      onValueChange={(value) =>
                        handleProductChange(item.key, value)
                      }
                      {...errorProps(`${line}.id_producto`, `id_producto-${item.key}`)}
                    />
                    <FieldError
                      id={`id_producto-${item.key}-error`}
                      messages={errorsOf(`${line}.id_producto`)}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Field
                      id={`cantidad-${item.key}`}
                      label="Cantidad"
                      required
                      disabled={!canCreateOrder}
                      errors={errorsOf(`${line}.cantidad`)}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          name="cantidad"
                          type="number"
                          min="1"
                          step="0.01"
                          value={item.cantidad}
                          onChange={(event) =>
                            updateItem(item.key, "cantidad", event.target.value)
                          }
                        />
                      )}
                    </Field>

                    <Field
                      id={`precio_unitario-${item.key}`}
                      label="Precio unitario"
                      required
                      disabled={!canCreateOrder}
                      errors={errorsOf(`${line}.precio_unitario`)}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          name="precio_unitario"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precio_unitario}
                          onChange={(event) =>
                            updateItem(
                              item.key,
                              "precio_unitario",
                              event.target.value,
                            )
                          }
                        />
                      )}
                    </Field>

                    <div className="space-y-2">
                      <Label htmlFor={`subtotal-${item.key}`}>Subtotal</Label>
                      <output
                        id={`subtotal-${item.key}`}
                        className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm"
                      >
                        S/ {subtotal}
                      </output>
                    </div>
                  </div>

                  <Field
                    id={`observacion_detalle-${item.key}`}
                    label="Observación del producto"
                    disabled={!canCreateOrder}
                    errors={errorsOf(`${line}.observaciones`)}
                    className="mt-4"
                  >
                    {(control) => (
                      <Input
                        {...control}
                        name="observacion_detalle"
                        value={item.observacion_detalle}
                        onChange={(event) =>
                          updateItem(
                            item.key,
                            "observacion_detalle",
                            event.target.value,
                          )
                        }
                        placeholder="Ejemplo: entregar pintado de color negro"
                      />
                    )}
                  </Field>

                  <FieldError messages={errorsOf(line)} />
                </div>
              );
            })}
          </div>

          <FieldError messages={errorsOf("items")} />

          <div className="flex justify-end border-t border-border/80 pt-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total estimado</p>
              <p className="text-2xl font-bold">S/ {amounts.total}</p>
            </div>
          </div>
        </div>

        <Field
          id="fecha_entrega_estimada"
          label="Fecha estimada de entrega"
          disabled={!canCreateOrder}
          errors={errorsOf("fecha_entrega_estimada")}
        >
          {(control) => (
            <Input
              {...control}
              name="fecha_entrega_estimada"
              type="date"
              defaultValue={fecha}
            />
          )}
        </Field>

        <Field
          id="observaciones"
          label="Observaciones generales del pedido"
          disabled={!canCreateOrder}
          errors={errorsOf("observaciones")}
        >
          {(control) => (
            <Textarea
              {...control}
              name="observaciones"
              placeholder="Ejemplo: Cliente solicita entrega urgente."
              className="min-h-24"
              defaultValue={observaciones}
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingText="Guardando..." disabled={!canCreateOrder}>
            {submitLabel}
          </SubmitButton>

          <Button variant="outline" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...(defaultValues?.id_pedido ? DISCARD_EDIT : DISCARD_NEW)} />
    </>
  );
}
