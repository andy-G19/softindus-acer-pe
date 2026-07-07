"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { SparePartFormState } from "@/modules/maintenance/spare-parts/actions";

type ProviderOption = {
  id: string;
  label: string;
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
  defaultValues,
  submitLabel,
}: SparePartFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

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
          <Label htmlFor="id_proveedor">Proveedor</Label>
          <NativeSelect
            id="id_proveedor"
            name="id_proveedor"
            defaultValue={getValue(defaultValues, "id_proveedor")}
          >
            <option value="">Sin proveedor</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </NativeSelect>
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
