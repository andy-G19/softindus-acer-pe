"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { calculatePurchaseAmounts } from "@/lib/purchase-amounts";
import { IGV_RATE_LABEL } from "@/lib/taxes";
import type {
  PurchaseFormState,
  PurchaseLineValues,
} from "@/modules/inventory/purchases/actions";

type MaterialOption = {
  id_material: string;
  nombre_material: string;
  unidad_medida: string;
  costo_unitario_actual: string;
};

type SupplierOption = {
  id_proveedor: string;
  razon_social: string;
};

type PurchaseItem = PurchaseLineValues & { key: string };

type PurchaseFormProps = {
  action: (prevState: PurchaseFormState, formData: FormData) => Promise<PurchaseFormState>;
  suppliers: SupplierOption[];
  materials: MaterialOption[];
  /**
   * Aviso que se da al guardar, del catalogo de Inventario. La pagina lo pasa con su clave
   * literal (inventoryNotifications["purchase-created"]) para que
   * notification-registry.test.ts vea quien emite la clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: PurchaseFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const DISCARD = {
  title: "¿Descartar la compra nueva?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

function createEmptyItem(key: string): PurchaseItem {
  return {
    key,
    id_material: "",
    cantidad: "1",
    unidad_medida: "",
    costo_unitario: "0",
    observaciones: "",
  };
}

// Formulario de crear compra (C3 de la 11.2b, D17): una pagina completa como pedidos (10.4c),
// no un panel. La accion devuelve un resultado: con error, el mensaje general queda dentro
// del formulario, sin toast, y cada error va junto a su campo, tambien los de una linea
// (items.<linea>.<campo>), y ActionForm enfoca el primero; con exito, se da un solo aviso, la
// clave de la operacion se renueva y se vuelve al listado con sus filtros (D19 revisada).
//
// Las lineas, el proveedor elegido y el IGV son estado del formulario: sobreviven al
// resultado de la accion, que remonta los campos (ActionForm) para que la fecha, el
// comprobante y las observaciones tomen lo enviado. Los ids de una linea llevan su key. El
// subtotal, el IGV y el total usan la regla con que se guardan (src/lib/purchase-amounts.ts).
//
// Descarte: con cambios, Cancelar pide confirmar y recargar o cerrar la pestana lo pregunta el
// navegador (useDiscardGuard). Lo que no dispara el evento input (elegir o limpiar un
// proveedor o un material, el interruptor del IGV, agregar o quitar una linea) marca el cambio
// a mano.
export function PurchaseForm({
  action,
  suppliers,
  materials,
  successNotification,
  returnTo,
}: PurchaseFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "idle" ? undefined : state.values;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;

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

  const [nextKey, setNextKey] = useState(2);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [appliesIgv, setAppliesIgv] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([createEmptyItem("row-1")]);

  const supplierItems = useMemo(
    () => suppliers.map((supplier) => ({ id: supplier.id_proveedor, label: supplier.razon_social })),
    [suppliers],
  );

  const materialItems = useMemo(
    () =>
      materials.map((material) => ({
        id: material.id_material,
        label: material.nombre_material,
        description: `${material.unidad_medida} - S/ ${Number(material.costo_unitario_actual).toFixed(2)}`,
      })),
    [materials],
  );

  // Vista previa con la misma regla que guarda la accion (src/lib/purchase-amounts.ts).
  const amounts = useMemo(
    () => calculatePurchaseAmounts({ items, aplicaIgv: appliesIgv }),
    [items, appliesIgv],
  );

  function errorsOf(key: string) {
    return fieldErrors?.[key];
  }

  // Props de error de un campo que no pasa por Field (las busquedas).
  function errorProps(key: string, id: string) {
    return errorsOf(key)?.length ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
  }

  function selectSupplier(supplierId: string) {
    setSelectedSupplier(supplierId);
    markDirty(true);
  }

  function setIgv(checked: boolean) {
    setAppliesIgv(checked);
    markDirty(true);
  }

  // Un clic normal en Cancelar pasa por el descarte; con una tecla de modificador o la
  // rueda, el enlace abre el listado en otra pestana.
  function handleCancel(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    controls.requestClose();
  }

  function addItem() {
    markDirty(true);
    setItems((currentItems) => [...currentItems, createEmptyItem(`row-${nextKey}`)]);
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

  function updateItem(key: string, field: keyof PurchaseLineValues, value: string) {
    setItems((currentItems) => currentItems.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  }

  function handleMaterialChange(key: string, materialId: string) {
    const selectedMaterial = materials.find((material) => material.id_material === materialId);

    markDirty(true);
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.key === key
          ? {
              ...item,
              id_material: materialId,
              unidad_medida: selectedMaterial?.unidad_medida ?? "",
              costo_unitario: selectedMaterial?.costo_unitario_actual ?? "0",
            }
          : item,
      ),
    );
  }

  return (
    <>
      <ActionForm
        action={formAction}
        pending={pending}
        resultKey={resultKey}
        className="space-y-6"
        onInput={() => markDirty(true)}
        onFocus={trackFocus}
      >
        <OperationKeyField scope="compra:nueva" completedKey={completedKey} />

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <SearchableSelect
              id="id_proveedor"
              name="id_proveedor"
              label="Proveedor"
              placeholder="Buscar proveedor..."
              items={supplierItems}
              value={selectedSupplier}
              onValueChange={selectSupplier}
              required
              emptyMessage="No hay proveedores activos."
              {...errorProps("id_proveedor", "id_proveedor")}
            />
            <FieldError id="id_proveedor-error" messages={errorsOf("id_proveedor")} />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Field id="fecha_compra" label="Fecha de compra" required errors={errorsOf("fecha_compra")}>
              {(control) => (
                <Input {...control} name="fecha_compra" type="date" defaultValue={values?.fecha_compra ?? ""} />
              )}
            </Field>

            <Field id="tipo_comprobante" label="Tipo comprobante" errors={errorsOf("tipo_comprobante")}>
              {(control) => (
                <NativeSelect
                  {...control}
                  name="tipo_comprobante"
                  defaultValue={values?.tipo_comprobante ?? ""}
                  onChange={(event) => setAppliesIgv(event.target.value === "factura")}
                >
                  <option value="">Sin comprobante</option>
                  <option value="boleta">Boleta</option>
                  <option value="factura">Factura</option>
                  <option value="recibo">Recibo</option>
                  <option value="otro">Otro</option>
                </NativeSelect>
              )}
            </Field>

            <Field id="numero_comprobante" label="Nro. comprobante" errors={errorsOf("numero_comprobante")}>
              {(control) => (
                <Input
                  {...control}
                  name="numero_comprobante"
                  placeholder="Ej. F001-000123"
                  defaultValue={values?.numero_comprobante ?? ""}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="aplica_igv">IGV</Label>

              <div className="flex h-8 items-center gap-3">
                <Switch
                  id="aplica_igv"
                  name="aplica_igv"
                  checked={appliesIgv}
                  onCheckedChange={setIgv}
                  aria-label={`Aplicar IGV de ${IGV_RATE_LABEL} sobre el total de la compra`}
                />

                <span className="text-sm font-medium text-foreground">
                  {appliesIgv ? `Se aplica IGV (${IGV_RATE_LABEL})` : "Sin IGV"}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                Se activa automáticamente al elegir factura. Puedes cambiarlo en cualquier momento.
              </p>
            </div>

            <Field id="observaciones" label="Observaciones" errors={errorsOf("observaciones")}>
              {(control) => (
                <Input
                  {...control}
                  name="observaciones"
                  placeholder="Observaciones generales de la compra"
                  defaultValue={values?.observaciones ?? ""}
                />
              )}
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Materiales comprados</h2>
              <p className="text-sm text-muted-foreground">Agrega uno o varios materiales dentro de la compra.</p>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              Agregar material
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => {
              const { subtotal } = amounts.lines[index];
              const line = `items.${index}`;

              return (
                <div key={item.key} className="rounded-lg border border-border/80 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-medium">Material #{index + 1}</p>

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

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <SearchableSelect
                        id={`id_material-${item.key}`}
                        name="id_material"
                        label="Material"
                        placeholder="Buscar material..."
                        items={materialItems}
                        value={item.id_material}
                        required
                        emptyMessage="No hay materiales activos."
                        onValueChange={(value) => handleMaterialChange(item.key, value)}
                        {...errorProps(`${line}.id_material`, `id_material-${item.key}`)}
                      />
                      <FieldError
                        id={`id_material-${item.key}-error`}
                        messages={errorsOf(`${line}.id_material`)}
                      />
                    </div>

                    <Field
                      id={`unidad_medida-${item.key}`}
                      label="Unidad"
                      required
                      errors={errorsOf(`${line}.unidad_medida`)}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          name="unidad_medida"
                          value={item.unidad_medida}
                          onChange={(event) => updateItem(item.key, "unidad_medida", event.target.value)}
                        />
                      )}
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Field
                      id={`cantidad-${item.key}`}
                      label="Cantidad"
                      required
                      errors={errorsOf(`${line}.cantidad`)}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          name="cantidad"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.cantidad}
                          onChange={(event) => updateItem(item.key, "cantidad", event.target.value)}
                        />
                      )}
                    </Field>

                    <Field
                      id={`costo_unitario-${item.key}`}
                      label="Costo unitario"
                      required
                      errors={errorsOf(`${line}.costo_unitario`)}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          name="costo_unitario"
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.costo_unitario}
                          onChange={(event) => updateItem(item.key, "costo_unitario", event.target.value)}
                        />
                      )}
                    </Field>

                    <div className="space-y-2">
                      <Label htmlFor={`subtotal-${item.key}`}>Subtotal</Label>
                      <output
                        id={`subtotal-${item.key}`}
                        className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm font-medium"
                      >
                        S/ {subtotal}
                      </output>
                    </div>
                  </div>

                  <Field
                    id={`item_observaciones-${item.key}`}
                    label="Observación del material"
                    errors={errorsOf(`${line}.observaciones`)}
                    className="mt-4"
                  >
                    {(control) => (
                      <Input
                        {...control}
                        name="item_observaciones"
                        value={item.observaciones}
                        onChange={(event) => updateItem(item.key, "observaciones", event.target.value)}
                      />
                    )}
                  </Field>

                  <FieldError messages={errorsOf(line)} />
                </div>
              );
            })}
          </div>

          <FieldError messages={errorsOf("items")} />

          <div className="space-y-2 rounded-lg bg-muted p-4 text-right">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Subtotal calculado</span>
              <span className="font-medium">S/ {amounts.subtotal}</span>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                IGV {appliesIgv ? `(${IGV_RATE_LABEL})` : "(no aplica)"}
              </span>
              <span className="font-medium">S/ {amounts.igv}</span>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border/80 pt-2">
              <span className="font-semibold">Total de la compra</span>
              <span className="text-2xl font-bold">S/ {amounts.total}</span>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>

          <SubmitButton pendingText="Guardando...">Registrar compra y entrada</SubmitButton>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
