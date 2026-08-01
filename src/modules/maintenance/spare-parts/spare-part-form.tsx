"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { showError, showSuccess } from "@/lib/notifications";
import { createQuickSupplierAction } from "@/modules/inventory/suppliers/actions";
import type { SparePartFormState } from "@/modules/maintenance/spare-parts/actions";

type ProviderOption = {
  id: string;
  label: string;
};

type SupplierTypeOption = {
  slug: string;
  nombre: string;
};

type SparePartValues = {
  id_repuesto?: string;
  id_proveedor: string;
  nombre_repuesto: string;
  descripcion: string;
  costo_unitario: string;
  estado: string;
};

type SparePartFormProps = {
  action: (
    prevState: SparePartFormState,
    formData: FormData,
  ) => Promise<SparePartFormState>;
  providers: ProviderOption[];
  supplierTypes: SupplierTypeOption[];
  defaultValues?: Partial<SparePartValues>;
  submitLabel: string;
};

const initialState: SparePartFormState = { error: "" };

function getValue(
  defaultValues: Partial<SparePartValues> | undefined,
  field: keyof SparePartValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function SparePartForm({
  action,
  providers,
  supplierTypes,
  defaultValues,
  submitLabel,
}: SparePartFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  // La lista de proveedores es estado local porque el alta rápida puede
  // agregarle uno nuevo sin recargar la página ni perder lo ya escrito.
  const [providerOptions, setProviderOptions] = useState(providers);
  const [selectedProvider, setSelectedProvider] = useState(
    getValue(defaultValues, "id_proveedor"),
  );
  const [isCreatingProvider, setIsCreatingProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderType, setNewProviderType] = useState(
    supplierTypes[0]?.slug ?? "",
  );
  const [newProviderPhone, setNewProviderPhone] = useState("");
  const [isSavingProvider, startSavingProvider] = useTransition();

  useEffect(() => {
    if (state.error) {
      showError(
        "No se pudo completar la operación",
        "Revise los datos ingresados e inténtelo nuevamente.",
      );
    }
  }, [state.error]);

  function resetProviderDraft() {
    setIsCreatingProvider(false);
    setNewProviderName("");
    setNewProviderPhone("");
    setNewProviderType(supplierTypes[0]?.slug ?? "");
  }

  function saveNewProvider() {
    startSavingProvider(async () => {
      const result = await createQuickSupplierAction({
        razon_social: newProviderName,
        tipo_proveedor: newProviderType,
        telefono: newProviderPhone,
      });

      if (!result.ok) {
        showError("No se pudo registrar el proveedor", result.error);
        return;
      }

      setProviderOptions((currentOptions) => {
        const alreadyListed = currentOptions.some(
          (option) => option.id === result.supplier.id,
        );

        if (alreadyListed) {
          return currentOptions;
        }

        return [...currentOptions, result.supplier].sort((a, b) =>
          a.label.localeCompare(b.label, "es"),
        );
      });

      setSelectedProvider(result.supplier.id);
      resetProviderDraft();
      showSuccess(
        "Proveedor registrado",
        `${result.supplier.label} quedó seleccionado en el repuesto.`,
      );
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id_repuesto ? (
        <input type="hidden" name="id_repuesto" value={defaultValues.id_repuesto} />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="nombre_repuesto">Nombre del repuesto</Label>
        <Input
          id="nombre_repuesto"
          name="nombre_repuesto"
          required
          defaultValue={getValue(defaultValues, "nombre_repuesto")}
        />
        <FieldError messages={state.fieldErrors?.nombre_repuesto} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <SearchableSelect
            name="id_proveedor"
            label="Proveedor"
            placeholder="Buscar proveedor..."
            items={providerOptions}
            value={selectedProvider}
            onValueChange={setSelectedProvider}
            emptyMessage="No se encontró ese proveedor. Puedes registrarlo aquí mismo."
          />

          {isCreatingProvider ? (
            <div className="space-y-3 rounded-lg border border-border/80 bg-card p-3">
              <p className="text-sm font-medium text-foreground">
                Nuevo proveedor
              </p>

              <div className="space-y-2">
                <Label htmlFor="nuevo_proveedor_razon_social">
                  Razón social
                </Label>
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
                  <Label htmlFor="nuevo_proveedor_telefono">
                    Teléfono (opcional)
                  </Label>
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
                Solo se piden los datos mínimos. El resto se completa después
                desde el módulo Proveedores.
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

          <FieldError messages={state.fieldErrors?.id_proveedor} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="costo_unitario">Costo unitario</Label>
          <Input
            id="costo_unitario"
            name="costo_unitario"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={getValue(defaultValues, "costo_unitario")}
          />
          <FieldError messages={state.fieldErrors?.costo_unitario} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="estado">Estado</Label>
        <NativeSelect
          id="estado"
          name="estado"
          required
          defaultValue={getValue(defaultValues, "estado") || "true"}
        >
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </NativeSelect>
        <FieldError messages={state.fieldErrors?.estado} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripcion</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          defaultValue={getValue(defaultValues, "descripcion")}
        />
        <FieldError messages={state.fieldErrors?.descripcion} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/maintenance/spare-parts">Volver al listado</Link>
        </Button>
      </div>
    </form>
  );
}
