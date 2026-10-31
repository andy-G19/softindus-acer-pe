"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { DiscardConfirmDialog, useDiscardGuard, useFormResult } from "@/components/forms/form-surface";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { calculateRepairAmounts } from "@/lib/repair-amounts";
import type { RepairFormState, RepairFormValues, RepairLineValues } from "@/modules/maintenance/repairs/actions";

type FailureOption = {
  id: string;
  label: string;
  description?: string;
};

type SparePartOption = FailureOption & {
  /** Costo del catalogo: la vista previa lo usa; la accion lo vuelve a leer al guardar. */
  costo_unitario: string;
};

type RepairItem = RepairLineValues & { key: string };

type RepairFormProps = {
  action: (prevState: RepairFormState, formData: FormData) => Promise<RepairFormState>;
  failures: FailureOption[];
  spareParts: SparePartOption[];
  /** Valores iniciales: la fecha de hoy y el estado. */
  defaultValues: Partial<RepairFormValues>;
  /**
   * Aviso que se da al guardar, del catalogo de Mantenimiento. La pagina lo
   * pasa con su clave literal (maintenanceNotifications["repair-created"]) para
   * que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: RepairFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const DISCARD = {
  title: "¿Descartar la reparación nueva?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

// Formulario de alta de reparaciones (entrega 10.5b), la superficie amplia de
// Mantenimiento, con el patron de Pedidos: una pagina completa, no un panel. La
// accion devuelve un resultado: con error, el mensaje general queda dentro del
// formulario, sin toast; cada error va junto a su campo, tambien los de una
// linea (items.<linea>.<campo>), y ActionForm enfoca el primero; con exito, se
// da un solo aviso y se vuelve al listado con sus filtros.
//
// La falla elegida, la mano de obra y las lineas son estado del formulario:
// sobreviven al resultado de la accion, que remonta los campos (ActionForm)
// para que los demas tomen lo enviado. Los ids de una linea llevan su key
// (useId cambiaria con los hermanos, y la posicion cambia al quitar una linea).
// La vista previa usa la funcion con que se guarda (src/lib/repair-amounts.ts)
// y el costo del catalogo que se cargo con la pagina; la accion lee el vigente
// al guardar.
//
// Los repuestos son opcionales: empieza sin lineas, y una linea vacia del todo
// no se guarda. Quitar una linea lleva el foco a Agregar repuesto: el boton que
// tenia el foco desaparece.
//
// Descarte (D4 de la 10.4): con cambios, Cancelar pide confirmar y recargar o
// cerrar la pestana lo pregunta el navegador. Un cambio es un evento input
// (SearchableSelect lo dispara al elegir) o agregar o quitar una linea.
export function RepairForm({ action, failures, spareParts, defaultValues, successNotification, returnTo }: RepairFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedFailure, setSelectedFailure] = useState(defaultValues.id_falla ?? "");
  const [laborCost, setLaborCost] = useState(defaultValues.mano_obra ?? "");
  const [items, setItems] = useState<RepairItem[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "idle" ? defaultValues : state.values;

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

  const costById = useMemo(
    () => new Map(spareParts.map((sparePart) => [sparePart.id, sparePart.costo_unitario])),
    [spareParts],
  );

  // Vista previa con la misma regla que guarda la accion (src/lib/repair-amounts.ts).
  const amounts = useMemo(
    () =>
      calculateRepairAmounts({
        mano_obra: laborCost,
        items: items.map((item) => ({
          cantidad: item.cantidad,
          costo_unitario: costById.get(item.id_repuesto) ?? "0",
        })),
      }),
    [costById, items, laborCost],
  );

  function errorsOf(key: string) {
    return fieldErrors?.[key];
  }

  // Props de error de un campo que no pasa por Field (las busquedas).
  function errorProps(key: string, id: string) {
    return errorsOf(key)?.length
      ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` }
      : {};
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
    setItems((currentItems) => [...currentItems, { key: `row-${nextKey}`, id_repuesto: "", cantidad: "1" }]);
    setNextKey((currentKey) => currentKey + 1);
  }

  // Quitar no marca cambios: solo se quita lo que antes se agrego.
  function removeItem(key: string) {
    setItems((currentItems) => currentItems.filter((item) => item.key !== key));
    addButtonRef.current?.focus();
  }

  function updateItem(key: string, field: keyof RepairLineValues, value: string) {
    setItems((currentItems) =>
      currentItems.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  }

  return (
    <>
      <ActionForm
        action={formAction}
        pending={pending}
        resultKey={resultKey}
        className="@container space-y-5"
        onInput={() => markDirty(true)}
        onFocus={trackFocus}
      >
        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <SearchableSelect
            id="id_falla"
            name="id_falla"
            label="Falla a reparar"
            placeholder="Buscar falla por maquina..."
            items={failures}
            value={selectedFailure}
            onValueChange={setSelectedFailure}
            required
            emptyMessage="No hay fallas pendientes o en atencion."
            {...errorProps("id_falla", "id_falla")}
          />
          <FieldError id="id_falla-error" messages={errorsOf("id_falla")} />
        </div>

        <div className="grid gap-4 @md:grid-cols-3">
          <Field id="fecha_reparacion" label="Fecha de reparacion" required errors={errorsOf("fecha_reparacion")}>
            {(control) => (
              <Input {...control} name="fecha_reparacion" type="date" defaultValue={values.fecha_reparacion} />
            )}
          </Field>

          <Field id="estado_reparacion" label="Estado" required errors={errorsOf("estado_reparacion")}>
            {(control) => (
              <NativeSelect {...control} name="estado_reparacion" defaultValue={values.estado_reparacion}>
                <option value="programada">Programada</option>
                <option value="ejecutada">Ejecutada</option>
                <option value="observada">Observada</option>
                <option value="anulada">Anulada</option>
              </NativeSelect>
            )}
          </Field>

          <Field id="mano_obra" label="Mano de obra" errors={errorsOf("mano_obra")}>
            {(control) => (
              <Input
                {...control}
                name="mano_obra"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ejemplo: 80.00"
                value={laborCost}
                onChange={(event) => setLaborCost(event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field id="tecnico_proveedor" label="Tecnico o proveedor" errors={errorsOf("tecnico_proveedor")}>
          {(control) => (
            <Input
              {...control}
              name="tecnico_proveedor"
              type="text"
              placeholder="Ejemplo: Tecnico interno / proveedor externo"
              defaultValue={values.tecnico_proveedor}
            />
          )}
        </Field>

        <div className="space-y-4 rounded-lg border border-border/80 bg-secondary/40 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Repuestos usados</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Agrega los repuestos usados. El costo unitario se toma automáticamente del catálogo de repuestos.
              </p>
            </div>

            <Button ref={addButtonRef} type="button" variant="outline" size="sm" onClick={addItem}>
              Agregar repuesto
            </Button>
          </div>

          {items.map((item, index) => {
            const { subtotal } = amounts.lines[index];
            const line = `items.${index}`;
            const repuestoId = `id_repuesto-${item.key}`;

            return (
              <div key={item.key} className="rounded-lg border border-border/80 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Repuesto {index + 1}</h3>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.key)}
                    className="text-destructive hover:text-destructive"
                  >
                    Quitar
                  </Button>
                </div>

                <div className="space-y-2">
                  <SearchableSelect
                    id={repuestoId}
                    name="id_repuesto"
                    label="Repuesto"
                    placeholder="Buscar repuesto..."
                    items={spareParts}
                    value={item.id_repuesto}
                    onValueChange={(value) => updateItem(item.key, "id_repuesto", value)}
                    emptyMessage="No hay repuestos activos."
                    {...errorProps(`${line}.id_repuesto`, repuestoId)}
                  />
                  <FieldError id={`${repuestoId}-error`} messages={errorsOf(`${line}.id_repuesto`)} />
                </div>

                <div className="mt-4 grid gap-4 @md:grid-cols-2">
                  <Field id={`cantidad-${item.key}`} label="Cantidad" errors={errorsOf(`${line}.cantidad`)}>
                    {(control) => (
                      <Input
                        {...control}
                        name="cantidad"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ejemplo: 1"
                        value={item.cantidad}
                        onChange={(event) => updateItem(item.key, "cantidad", event.target.value)}
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

                <FieldError messages={errorsOf(line)} />
              </div>
            );
          })}

          <dl className="space-y-1 border-t border-border/80 pt-4 text-right text-sm">
            <div className="flex justify-end gap-3">
              <dt className="text-muted-foreground">Repuestos</dt>
              <dd>S/ {amounts.sparePartsTotal}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-muted-foreground">Mano de obra</dt>
              <dd>S/ {amounts.mano_obra ?? "0.00"}</dd>
            </div>
            <div className="flex items-baseline justify-end gap-3">
              <dt className="text-muted-foreground">Costo total</dt>
              <dd className="text-2xl font-bold">S/ {amounts.total}</dd>
            </div>
          </dl>
        </div>

        <Field id="observaciones" label="Observaciones" errors={errorsOf("observaciones")}>
          {(control) => (
            <Textarea
              {...control}
              name="observaciones"
              rows={4}
              placeholder="Ejemplo: Se cambio la manguera hidraulica y se realizo prueba de presion."
              defaultValue={values.observaciones}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton pendingText="Guardando...">Registrar reparacion</SubmitButton>
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
