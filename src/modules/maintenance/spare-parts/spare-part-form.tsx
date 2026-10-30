"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useMemo, useState, useTransition } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { createQuickSupplierAction } from "@/modules/inventory/suppliers/actions";
import type { SparePartFormState, SparePartFormValues } from "@/modules/maintenance/spare-parts/actions";

type ProviderOption = {
  id: string;
  label: string;
  /** «Inactivo» en el proveedor actual del repuesto que se edita. */
  description?: string;
};

type SupplierTypeOption = {
  slug: string;
  nombre: string;
};

type SparePartFormProps = {
  action: (prevState: SparePartFormState, formData: FormData) => Promise<SparePartFormState>;
  providers: ProviderOption[];
  supplierTypes: SupplierTypeOption[];
  /** Valores del repuesto que se edita; en el alta, el estado inicial. */
  defaultValues?: Partial<SparePartFormValues> & { id_repuesto?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Mantenimiento. La pagina lo
   * pasa con su clave literal (maintenanceNotifications["spare-part-created"])
   * para que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: SparePartFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: SparePartFormValues = {
  id_proveedor: "",
  nombre_repuesto: "",
  descripcion: "",
  costo_unitario: "",
  estado: "",
};

// Formulario de alta y edicion de repuestos (entrega 10.5a), con el patron de
// Maquinas y Productos. La accion devuelve un resultado: con error,
// ActionForm vuelve a mostrar lo enviado y enfoca el primer campo invalido, y
// el mensaje general queda dentro del formulario, sin toast; con exito, se da
// un solo aviso y se vuelve al listado con sus filtros. Los ids son los name de
// los campos (useId cambiaria con los hermanos).
//
// Dentro de un RouteSheet (el panel de las rutas interceptadas) los campos van
// en el cuerpo desplazable y los botones en el pie fijo; Cancelar pide cerrar
// el panel (con confirmacion si hay cambios), guardar lo cierra volviendo atras
// y, mientras la accion esta pendiente, el panel no se cierra. En la pagina
// completa, Volver al listado es un enlace al returnTo y guardar navega a el.
//
// El alta rapida de proveedor (D3 de la 10.5a) no da avisos sueltos: su error
// queda en su recuadro y, con exito, el proveedor nuevo queda elegido y una
// linea bajo el campo lo dice.
export function SparePartForm({
  action,
  providers,
  supplierTypes,
  defaultValues,
  submitLabel,
  successNotification,
  returnTo,
}: SparePartFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const values = state.status === "idle" ? { ...emptyValues, ...defaultValues } : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  // La lista de proveedores es estado local porque el alta rápida puede
  // agregarle uno nuevo sin recargar la página ni perder lo ya escrito.
  const [providerOptions, setProviderOptions] = useState(providers);
  const [selectedProvider, setSelectedProvider] = useState(defaultValues?.id_proveedor ?? "");
  const [isCreatingProvider, setIsCreatingProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderType, setNewProviderType] = useState(supplierTypes[0]?.slug ?? "");
  const [newProviderPhone, setNewProviderPhone] = useState("");
  const [newProviderError, setNewProviderError] = useState("");
  const [newProviderNotice, setNewProviderNotice] = useState("");
  const [isSavingProvider, startSavingProvider] = useTransition();

  const notification = useMemo(
    () => (hasListFilters(returnTo) ? { ...successNotification, description: FILTER_HINT } : successNotification),
    [successNotification, returnTo],
  );
  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);

  // Un aviso por operacion; en el panel lo cierra y en la pagina vuelve al listado.
  useFormResult(state, pending, { successNotification: notification, onSuccess: goBack });

  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const providerErrors = fieldErrors?.id_proveedor;

  function resetProviderDraft() {
    setIsCreatingProvider(false);
    setNewProviderName("");
    setNewProviderPhone("");
    setNewProviderError("");
    setNewProviderType(supplierTypes[0]?.slug ?? "");
  }

  function selectProvider(value: string) {
    setSelectedProvider(value);
    setNewProviderNotice("");
  }

  function saveNewProvider() {
    startSavingProvider(async () => {
      const result = await createQuickSupplierAction({
        razon_social: newProviderName,
        tipo_proveedor: newProviderType,
        telefono: newProviderPhone,
      });

      if (!result.ok) {
        setNewProviderError(result.error);
        return;
      }

      setProviderOptions((currentOptions) => {
        const alreadyListed = currentOptions.some((option) => option.id === result.supplier.id);

        if (alreadyListed) {
          return currentOptions;
        }

        return [...currentOptions, result.supplier].sort((a, b) => a.label.localeCompare(b.label, "es"));
      });

      setSelectedProvider(result.supplier.id);
      resetProviderDraft();
      setNewProviderNotice(`${result.supplier.label} quedó seleccionado en el repuesto.`);
    });
  }

  const fields = (
    <>
      {defaultValues?.id_repuesto ? (
        <input type="hidden" name="id_repuesto" value={defaultValues.id_repuesto} />
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field id="nombre_repuesto" label="Nombre del repuesto" required errors={fieldErrors?.nombre_repuesto}>
        {(control) => <Input {...control} name="nombre_repuesto" defaultValue={values.nombre_repuesto} />}
      </Field>

      <div className="grid gap-4 @md:grid-cols-2">
        <div className="space-y-2">
          <SearchableSelect
            id="id_proveedor"
            name="id_proveedor"
            label="Proveedor"
            placeholder="Buscar proveedor..."
            items={providerOptions}
            value={selectedProvider}
            onValueChange={selectProvider}
            emptyMessage="No se encontró ese proveedor. Puedes registrarlo aquí mismo."
            {...(providerErrors?.length
              ? { "aria-invalid": true as const, "aria-describedby": "id_proveedor-error" }
              : {})}
          />

          {newProviderNotice ? (
            <p role="status" className="text-xs text-muted-foreground">
              {newProviderNotice}
            </p>
          ) : null}

          {isCreatingProvider ? (
            <div className="space-y-3 rounded-lg border border-border/80 bg-card p-3">
              <p className="text-sm font-medium text-foreground">Nuevo proveedor</p>

              {newProviderError ? (
                <p role="alert" className="text-sm text-destructive">
                  {newProviderError}
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="nuevo_proveedor_razon_social">Razón social</Label>
                <Input
                  id="nuevo_proveedor_razon_social"
                  value={newProviderName}
                  onChange={(event) => setNewProviderName(event.target.value)}
                  placeholder="Ej. Ferretería San Martín"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nuevo_proveedor_tipo">Tipo</Label>
                  <NativeSelect
                    id="nuevo_proveedor_tipo"
                    value={newProviderType}
                    onChange={(event) => setNewProviderType(event.target.value)}
                  >
                    {supplierTypes.map((supplierType) => (
                      <option key={supplierType.slug} value={supplierType.slug}>
                        {supplierType.nombre}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nuevo_proveedor_telefono">Teléfono (opcional)</Label>
                  <Input
                    id="nuevo_proveedor_telefono"
                    value={newProviderPhone}
                    onChange={(event) => setNewProviderPhone(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={saveNewProvider}
                  disabled={isSavingProvider || newProviderName.trim().length < 2}
                >
                  {isSavingProvider ? "Registrando..." : "Registrar y usar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={resetProviderDraft}
                  disabled={isSavingProvider}
                >
                  Cancelar
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Solo se piden los datos mínimos. El resto se completa después desde el módulo Proveedores.
              </p>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingProvider(true)}
              disabled={supplierTypes.length === 0}
            >
              Registrar proveedor nuevo
            </Button>
          )}

          <FieldError id="id_proveedor-error" messages={providerErrors} />
        </div>

        <Field id="costo_unitario" label="Costo unitario" required errors={fieldErrors?.costo_unitario}>
          {(control) => (
            <Input
              {...control}
              name="costo_unitario"
              type="number"
              min="0"
              step="0.01"
              defaultValue={values.costo_unitario}
            />
          )}
        </Field>
      </div>

      <Field id="estado" label="Estado" required errors={fieldErrors?.estado}>
        {(control) => (
          <NativeSelect {...control} name="estado" defaultValue={values.estado || "true"}>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </NativeSelect>
        )}
      </Field>

      <Field id="descripcion" label="Descripcion" errors={fieldErrors?.descripcion}>
        {(control) => <Textarea {...control} name="descripcion" rows={4} defaultValue={values.descripcion} />}
      </Field>
    </>
  );

  if (panel) {
    return (
      <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="@container space-y-4">{fields}</SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={panel.requestClose}>
            Cancelar
          </Button>
          <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
        </SheetFooter>
      </ActionForm>
    );
  }

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="@container space-y-4">
      {fields}

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
        <Button variant="outline" asChild>
          <Link href={returnTo}>Volver al listado</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
