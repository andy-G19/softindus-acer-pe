"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { SupplierMaterialFormState } from "@/modules/inventory/supplier-materials/actions";

type Option = {
  id: string;
  label: string;
};

type SupplierMaterialValues = {
  id_proveedor_material?: string;
  id_proveedor: string;
  id_material: string;
  unidad_medida: string;
  precio_referencial: string;
  tiempo_entrega_dias: string;
  disponibilidad: string;
};

type SupplierMaterialFormProps = {
  action: (
    prevState: SupplierMaterialFormState,
    formData: FormData,
  ) => Promise<SupplierMaterialFormState>;
  suppliers: Option[];
  materials: Option[];
  defaultValues?: Partial<SupplierMaterialValues>;
  submitLabel: string;
  cancelHref?: string;
  cancelLabel?: string;
  showCancelAction?: boolean;
};

const initialState: SupplierMaterialFormState = { error: "" };

const availabilityOptions = [
  { value: "", label: "Sin definir" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
  { value: "no_disponible", label: "No disponible" },
];

function getValue(
  defaultValues: Partial<SupplierMaterialValues> | undefined,
  field: keyof SupplierMaterialValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function SupplierMaterialForm({
  action,
  suppliers,
  materials,
  defaultValues,
  submitLabel,
  cancelHref = "/dashboard/inventory/supplier-materials",
  cancelLabel = "Cancelar",
  showCancelAction = true,
}: SupplierMaterialFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const hasOptions = suppliers.length > 0 && materials.length > 0;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-border/80 bg-card p-6"
    >
      {defaultValues?.id_proveedor_material ? (
        <input
          type="hidden"
          name="id_proveedor_material"
          value={defaultValues.id_proveedor_material}
        />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasOptions ? (
        <Alert variant="warning">
          <AlertDescription>
            Deben existir proveedores y materiales activos para crear
            asociaciones.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="id_proveedor">Proveedor</Label>
          <NativeSelect
            id="id_proveedor"
            name="id_proveedor"
            defaultValue={getValue(defaultValues, "id_proveedor")}
            disabled={suppliers.length === 0}
            required
          >
            <option value="">Selecciona un proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.label}
              </option>
            ))}
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.id_proveedor} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="id_material">Material</Label>
          <NativeSelect
            id="id_material"
            name="id_material"
            defaultValue={getValue(defaultValues, "id_material")}
            disabled={materials.length === 0}
            required
          >
            <option value="">Selecciona un material</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.label}
              </option>
            ))}
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.id_material} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="unidad_medida">Unidad de medida</Label>
          <Input
            id="unidad_medida"
            name="unidad_medida"
            defaultValue={getValue(defaultValues, "unidad_medida")}
            required
          />
          <FieldError messages={state.fieldErrors?.unidad_medida} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="precio_referencial">Precio referencial</Label>
          <Input
            id="precio_referencial"
            name="precio_referencial"
            type="number"
            min="0"
            step="0.01"
            defaultValue={getValue(defaultValues, "precio_referencial")}
          />
          <FieldError messages={state.fieldErrors?.precio_referencial} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tiempo_entrega_dias">Tiempo de entrega (dias)</Label>
          <Input
            id="tiempo_entrega_dias"
            name="tiempo_entrega_dias"
            type="number"
            min="0"
            step="1"
            defaultValue={getValue(defaultValues, "tiempo_entrega_dias")}
          />
          <FieldError messages={state.fieldErrors?.tiempo_entrega_dias} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="disponibilidad">Disponibilidad</Label>
          <NativeSelect
            id="disponibilidad"
            name="disponibilidad"
            defaultValue={getValue(defaultValues, "disponibilidad")}
          >
            {availabilityOptions.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.disponibilidad} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={isPending || !hasOptions}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>

        {showCancelAction ? (
          <Button variant="outline" asChild>
            <Link href={cancelHref}>{cancelLabel}</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
