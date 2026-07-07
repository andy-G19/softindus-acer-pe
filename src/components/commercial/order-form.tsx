"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createOrderAction,
  type OrderFormState,
} from "@/modules/commercial/orders/actions";

type ClientOption = {
  id_cliente: string;
  nombre_razon_social: string;
  tipo_cliente: string;
};

type ProductOption = {
  id_producto: string;
  nombre_producto: string;
  categoria: string;
  unidad_medida: string;
  precio_referencial: string | null;
};

type OrderItem = {
  key: string;
  id_producto: string;
  cantidad: string;
  precio_unitario: string;
  observacion_detalle: string;
};

type OrderFormProps = {
  clients: ClientOption[];
  products: ProductOption[];
  action?: (
    prevState: OrderFormState,
    formData: FormData,
  ) => Promise<OrderFormState>;
  defaultValues?: {
    id_pedido?: string;
    id_cliente?: string;
    fecha_entrega_estimada?: string;
    observaciones?: string;
    items?: Omit<OrderItem, "key">[];
  };
  submitLabel?: string;
};

const initialState: OrderFormState = { error: "" };

function formatMoney(value: string | null) {
  if (!value) {
    return "Sin precio";
  }

  return `S/ ${Number(value).toFixed(2)}`;
}

function createEmptyItem(key: string): OrderItem {
  return {
    key,
    id_producto: "",
    cantidad: "1",
    precio_unitario: "",
    observacion_detalle: "",
  };
}

export function OrderForm({
  clients,
  products,
  action = createOrderAction,
  defaultValues,
  submitLabel = "Guardar pedido",
}: OrderFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
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
  const [items, setItems] = useState<OrderItem[]>(
    initialItems,
  );

  const canCreateOrder = clients.length > 0 && products.length > 0;

  const clientItems = useMemo(() => {
    return clients.map((client) => ({
      id: client.id_cliente,
      label: client.nombre_razon_social,
      description: client.tipo_cliente,
    }));
  }, [clients]);

  const productItems = useMemo(() => {
    return products.map((product) => ({
      id: product.id_producto,
      label: product.nombre_producto,
      description: `${product.categoria} - ${product.unidad_medida} - ${formatMoney(
        product.precio_referencial,
      )}`,
    }));
  }, [products]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const cantidad = Number(item.cantidad || 0);
      const precio = Number(item.precio_unitario || 0);
      return sum + cantidad * precio;
    }, 0);
  }, [items]);

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      createEmptyItem(`row-${nextKey}`),
    ]);

    setNextKey((currentKey) => currentKey + 1);
  }

  function removeItem(key: string) {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems;
      }

      return currentItems.filter((item) => item.key !== key);
    });
  }

  function updateItem(key: string, field: keyof OrderItem, value: string) {
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
    <form
      action={formAction}
      className="space-y-5 rounded-lg border border-border/80 bg-card p-6"
    >
      {defaultValues?.id_pedido ? (
        <input type="hidden" name="id_pedido" value={defaultValues.id_pedido} />
      ) : null}

      {state.error ? (
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
          name="id_cliente"
          label="Cliente"
          placeholder="Buscar cliente..."
          items={clientItems}
          required
          disabled={!canCreateOrder}
          value={selectedClient}
          onValueChange={setSelectedClient}
          emptyMessage="No hay clientes activos."
        />
        {state.fieldErrors?.id_cliente ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.id_cliente[0]}
          </p>
        ) : null}
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
            const subtotal =
              Number(item.cantidad || 0) * Number(item.precio_unitario || 0);

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
                  />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input
                      name="cantidad"
                      type="number"
                      min="1"
                      step="0.01"
                      value={item.cantidad}
                      onChange={(event) =>
                        updateItem(item.key, "cantidad", event.target.value)
                      }
                      required
                      disabled={!canCreateOrder}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Precio unitario</Label>
                    <Input
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
                      required
                      disabled={!canCreateOrder}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Subtotal</Label>
                    <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm">
                      S/ {subtotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label>Observacion del producto</Label>
                  <Input
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
                    disabled={!canCreateOrder}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-border/80 pt-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total estimado</p>
            <p className="text-2xl font-bold">S/ {total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Fecha estimada de entrega</Label>
        <Input
          name="fecha_entrega_estimada"
          type="date"
          defaultValue={defaultValues?.fecha_entrega_estimada ?? ""}
          disabled={!canCreateOrder}
        />
        {state.fieldErrors?.fecha_entrega_estimada ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.fecha_entrega_estimada[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Observaciones generales del pedido</Label>
        <Textarea
          name="observaciones"
          placeholder="Ejemplo: Cliente solicita entrega urgente."
          className="min-h-24"
          disabled={!canCreateOrder}
          defaultValue={defaultValues?.observaciones ?? ""}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canCreateOrder || isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>

        <Button variant="outline" asChild>
          <Link href="/dashboard/commercial/orders">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
