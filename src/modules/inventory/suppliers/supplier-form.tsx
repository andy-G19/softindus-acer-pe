"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { showError } from "@/lib/notifications";
import type { SupplierFormState } from "@/modules/inventory/suppliers/actions";

type SupplierTypeOption = {
  slug: string;
  nombre: string;
};

type SupplierFormValues = {
  id_proveedor?: string;
  razon_social: string;
  tipo_documento: string;
  numero_documento: string;
  telefono: string;
  correo: string;
  direccion: string;
  contacto_principal: string;
  tipo_proveedor: string;
  condicion_pago: string;
  observaciones: string;
};

type SupplierFormProps = {
  action: (
    prevState: SupplierFormState,
    formData: FormData,
  ) => Promise<SupplierFormState>;
  supplierTypes: SupplierTypeOption[];
  defaultValues?: Partial<SupplierFormValues>;
  submitLabel: string;
  cancelHref?: string;
  cancelLabel?: string;
  showCancelAction?: boolean;
};

const initialState: SupplierFormState = {
  error: "",
};

function getValue(
  defaultValues: Partial<SupplierFormValues> | undefined,
  field: keyof SupplierFormValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function SupplierForm({
  action,
  supplierTypes,
  defaultValues,
  submitLabel,
  cancelHref = "/dashboard/inventory/suppliers",
  cancelLabel = "Cancelar",
  showCancelAction = true,
}: SupplierFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const hasSupplierTypes = supplierTypes.length > 0;

  useEffect(() => {
    if (state.error) {
      showError(
        "No se pudo completar la operación",
        "Revise los datos ingresados e inténtelo nuevamente.",
      );
    }
  }, [state.error]);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
    >
      {defaultValues?.id_proveedor ? (
        <input
          type="hidden"
          name="id_proveedor"
          value={defaultValues.id_proveedor}
        />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasSupplierTypes ? (
        <Alert variant="info">
          <AlertDescription>
            No hay tipos de proveedor activos.{" "}
            <Link href="/dashboard/inventory/supplier-types">
              Crear tipos de proveedor
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="razon_social">Razón social *</Label>
        <Input
          id="razon_social"
          name="razon_social"
          required
          placeholder="Ej. Aceros del Sur S.A.C."
          defaultValue={getValue(defaultValues, "razon_social")}
        />
        <FieldError messages={state.fieldErrors?.razon_social} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tipo_documento">Tipo de documento</Label>
          <NativeSelect
            id="tipo_documento"
            name="tipo_documento"
            defaultValue={getValue(defaultValues, "tipo_documento")}
          >
            <option value="">Sin documento</option>
            <option value="ruc">RUC</option>
            <option value="dni">DNI</option>
            <option value="otro">Otro</option>
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.tipo_documento} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="numero_documento">Número de documento</Label>
          <Input
            id="numero_documento"
            name="numero_documento"
            placeholder="Ej. 20601234567"
            defaultValue={getValue(defaultValues, "numero_documento")}
          />
          <FieldError messages={state.fieldErrors?.numero_documento} />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            placeholder="Ej. 999 888 777"
            defaultValue={getValue(defaultValues, "telefono")}
          />
          <FieldError messages={state.fieldErrors?.telefono} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="correo">Correo</Label>
          <Input
            id="correo"
            name="correo"
            type="email"
            placeholder="proveedor@correo.com"
            defaultValue={getValue(defaultValues, "correo")}
          />
          <FieldError messages={state.fieldErrors?.correo} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="direccion">Dirección</Label>
        <Input
          id="direccion"
          name="direccion"
          placeholder="Dirección comercial"
          defaultValue={getValue(defaultValues, "direccion")}
        />
        <FieldError messages={state.fieldErrors?.direccion} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contacto_principal">Contacto principal</Label>
          <Input
            id="contacto_principal"
            name="contacto_principal"
            placeholder="Nombre de la persona de contacto"
            defaultValue={getValue(defaultValues, "contacto_principal")}
          />
          <FieldError messages={state.fieldErrors?.contacto_principal} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tipo_proveedor">Tipo de proveedor *</Label>
          <NativeSelect
            id="tipo_proveedor"
            name="tipo_proveedor"
            required
            disabled={!hasSupplierTypes}
            defaultValue={getValue(defaultValues, "tipo_proveedor")}
          >
            <option value="">Selecciona un tipo</option>
            {supplierTypes.map((type) => (
              <option key={type.slug} value={type.slug}>
                {type.nombre}
              </option>
            ))}
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.tipo_proveedor} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="condicion_pago">Condición de pago</Label>
        <NativeSelect
          id="condicion_pago"
          name="condicion_pago"
          defaultValue={getValue(defaultValues, "condicion_pago")}
        >
          <option value="">No especificado</option>
          <option value="contado">Contado</option>
          <option value="credito">Crédito</option>
          <option value="parcial">Parcial</option>
          <option value="otro">Otro</option>
        </NativeSelect>
        <FieldError messages={state.fieldErrors?.condicion_pago} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea
          id="observaciones"
          name="observaciones"
          rows={4}
          placeholder="Notas adicionales sobre el proveedor"
          defaultValue={getValue(defaultValues, "observaciones")}
        />
        <FieldError messages={state.fieldErrors?.observaciones} />
      </div>

      <div className="flex items-center justify-between pt-4">
        {showCancelAction ? (
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={cancelHref}>{cancelLabel}</Link>
          </Button>
        ) : (
          <span />
        )}

        <Button type="submit" disabled={isPending || !hasSupplierTypes}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
