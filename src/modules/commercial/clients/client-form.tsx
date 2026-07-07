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
import type { ClientFormState } from "@/modules/commercial/clients/actions";

type ClientFormValues = {
  id_cliente?: string;
  tipo_cliente: string;
  nombre_razon_social: string;
  tipo_documento: string;
  numero_documento: string;
  telefono: string;
  correo: string;
  direccion: string;
  lugar_origen: string;
  observaciones: string;
};

type ClientFormProps = {
  action: (
    prevState: ClientFormState,
    formData: FormData,
  ) => Promise<ClientFormState>;
  defaultValues?: Partial<ClientFormValues>;
  submitLabel: string;
  cancelHref?: string;
  cancelLabel?: string;
  showCancelAction?: boolean;
};

const initialState: ClientFormState = {
  error: "",
};

const clientTypeOptions = [
  { value: "cliente_final", label: "Cliente final" },
  { value: "ferreteria", label: "Ferretería" },
  { value: "distribuidora", label: "Distribuidora" },
  { value: "constructora", label: "Constructora" },
  { value: "otro", label: "Otro" },
];

const documentTypeOptions = [
  { value: "", label: "Sin documento" },
  { value: "dni", label: "DNI" },
  { value: "ruc", label: "RUC" },
  { value: "otro", label: "Otro" },
];

function getValue(
  defaultValues: Partial<ClientFormValues> | undefined,
  field: keyof ClientFormValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function ClientForm({
  action,
  defaultValues,
  submitLabel,
  cancelHref = "/dashboard/commercial/clients",
  cancelLabel = "Cancelar",
  showCancelAction = true,
}: ClientFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

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
      className="space-y-4 rounded-lg border border-border/80 bg-card p-6"
    >
      {defaultValues?.id_cliente ? (
        <input
          type="hidden"
          name="id_cliente"
          value={defaultValues.id_cliente}
        />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="tipo_cliente">Tipo de cliente</Label>
        <NativeSelect
          id="tipo_cliente"
          name="tipo_cliente"
          defaultValue={getValue(defaultValues, "tipo_cliente") || "cliente_final"}
          required
        >
          {clientTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <FieldError messages={state.fieldErrors?.tipo_cliente} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nombre_razon_social">Nombre o razón social</Label>
        <Input
          id="nombre_razon_social"
          name="nombre_razon_social"
          defaultValue={getValue(defaultValues, "nombre_razon_social")}
          required
        />
        <FieldError messages={state.fieldErrors?.nombre_razon_social} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tipo_documento">Tipo de documento</Label>
          <NativeSelect
            id="tipo_documento"
            name="tipo_documento"
            defaultValue={getValue(defaultValues, "tipo_documento")}
          >
            {documentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.tipo_documento} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="numero_documento">Número de documento</Label>
          <Input
            id="numero_documento"
            name="numero_documento"
            defaultValue={getValue(defaultValues, "numero_documento")}
          />
          <FieldError messages={state.fieldErrors?.numero_documento} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            defaultValue={getValue(defaultValues, "telefono")}
          />
          <FieldError messages={state.fieldErrors?.telefono} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="correo">Correo</Label>
          <Input
            id="correo"
            type="email"
            name="correo"
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
          defaultValue={getValue(defaultValues, "direccion")}
        />
        <FieldError messages={state.fieldErrors?.direccion} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lugar_origen">Lugar de origen</Label>
        <Input
          id="lugar_origen"
          name="lugar_origen"
          defaultValue={getValue(defaultValues, "lugar_origen")}
        />
        <FieldError messages={state.fieldErrors?.lugar_origen} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea
          id="observaciones"
          name="observaciones"
          defaultValue={getValue(defaultValues, "observaciones")}
        />
        <FieldError messages={state.fieldErrors?.observaciones} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
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
