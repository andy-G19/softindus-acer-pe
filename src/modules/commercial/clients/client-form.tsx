"use client";

import Link from "next/link";
import { useActionState } from "react";

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
}: ClientFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border p-6">
      {defaultValues?.id_cliente ? (
        <input
          type="hidden"
          name="id_cliente"
          value={defaultValues.id_cliente}
        />
      ) : null}

      {state.error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="tipo_cliente" className="text-sm font-medium">
          Tipo de cliente
        </label>
        <select
          id="tipo_cliente"
          name="tipo_cliente"
          className="w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "tipo_cliente") || "cliente_final"}
          required
        >
          {clientTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError messages={state.fieldErrors?.tipo_cliente} />
      </div>

      <div className="space-y-2">
        <label htmlFor="nombre_razon_social" className="text-sm font-medium">
          Nombre o razón social
        </label>
        <input
          id="nombre_razon_social"
          name="nombre_razon_social"
          className="w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "nombre_razon_social")}
          required
        />
        <FieldError messages={state.fieldErrors?.nombre_razon_social} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="tipo_documento" className="text-sm font-medium">
            Tipo de documento
          </label>
          <select
            id="tipo_documento"
            name="tipo_documento"
            className="w-full rounded-md border px-3 py-2"
            defaultValue={getValue(defaultValues, "tipo_documento")}
          >
            {documentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.tipo_documento} />
        </div>

        <div className="space-y-2">
          <label htmlFor="numero_documento" className="text-sm font-medium">
            Número de documento
          </label>
          <input
            id="numero_documento"
            name="numero_documento"
            className="w-full rounded-md border px-3 py-2"
            defaultValue={getValue(defaultValues, "numero_documento")}
          />
          <FieldError messages={state.fieldErrors?.numero_documento} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="telefono" className="text-sm font-medium">
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            className="w-full rounded-md border px-3 py-2"
            defaultValue={getValue(defaultValues, "telefono")}
          />
          <FieldError messages={state.fieldErrors?.telefono} />
        </div>

        <div className="space-y-2">
          <label htmlFor="correo" className="text-sm font-medium">
            Correo
          </label>
          <input
            id="correo"
            type="email"
            name="correo"
            className="w-full rounded-md border px-3 py-2"
            defaultValue={getValue(defaultValues, "correo")}
          />
          <FieldError messages={state.fieldErrors?.correo} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="direccion" className="text-sm font-medium">
          Dirección
        </label>
        <input
          id="direccion"
          name="direccion"
          className="w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "direccion")}
        />
        <FieldError messages={state.fieldErrors?.direccion} />
      </div>

      <div className="space-y-2">
        <label htmlFor="lugar_origen" className="text-sm font-medium">
          Lugar de origen
        </label>
        <input
          id="lugar_origen"
          name="lugar_origen"
          className="w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "lugar_origen")}
        />
        <FieldError messages={state.fieldErrors?.lugar_origen} />
      </div>

      <div className="space-y-2">
        <label htmlFor="observaciones" className="text-sm font-medium">
          Observaciones
        </label>
        <textarea
          id="observaciones"
          name="observaciones"
          className="w-full rounded-md border px-3 py-2"
          defaultValue={getValue(defaultValues, "observaciones")}
        />
        <FieldError messages={state.fieldErrors?.observaciones} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Guardando..." : submitLabel}
        </button>

        <Link
          href="/dashboard/commercial/clients"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Volver a clientes
        </Link>
      </div>
    </form>
  );
}
