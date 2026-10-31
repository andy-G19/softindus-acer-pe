"use client";

import { useState, type ReactNode } from "react";

import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { NativeSelect } from "@/components/ui/native-select";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { RowStatusState } from "@/lib/requested-status";

type RowStatusConfirm = {
  title: string;
  description: ReactNode;
  confirmText: string;
  /** Anular usa la destructiva; un estado final que no borra nada, default. */
  variant?: "default" | "destructive";
};

type RowStatusSelectProps = {
  action: (prevState: RowStatusState, formData: FormData) => Promise<RowStatusState>;
  /** id del selector; se escribe explicito con el del registro (useId cambia con los hermanos). */
  id: string;
  /** Campos del registro: su id. */
  fields: Record<string, string>;
  /** Nombre del campo del estado pedido. */
  name: string;
  /** Nombre del selector para el lector de pantalla: "Estado de la falla FAL00000001". */
  label: string;
  /** Estado que muestra el selector. */
  value: string;
  /**
   * Estado guardado, si no es el que se muestra: un preventivo pendiente con
   * fecha pasada se muestra «Vencido», y guardarlo si es un cambio.
   */
  storedValue?: string;
  options: { value: string; label: string }[];
  /** Aviso del catalogo del area; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
  /** Confirmacion por estado pedido; los que no aparecen se aplican al pulsar. */
  confirm?: Record<string, RowStatusConfirm>;
};

// Cambiar el estado de un registro desde su fila (entrega 10.5b): el selector y
// «Guardar», apoyados en ConfirmActionButton, que da el pendiente, el aviso
// unico, la confirmacion y el foco. Guardar envia el estado pedido; sin cambio
// respecto del guardado el boton no hace nada, sin perder el foco. Sin
// confirmacion, un error queda en la fila; con ella, dentro de la confirmacion.
// Cuando la lista se vuelve a pintar con otro estado, el selector lo toma.
export function RowStatusSelect({
  action,
  id,
  fields,
  name,
  label,
  value,
  storedValue = value,
  options,
  successNotification,
  confirm,
}: RowStatusSelectProps) {
  const [selected, setSelected] = useState(value);
  const [shownValue, setShownValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const errorId = `${id}-error`;

  if (value !== shownValue) {
    setShownValue(value);
    setSelected(value);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <NativeSelect
          id={id}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setError(null);
          }}
          className="h-8 text-xs"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>

        <ConfirmActionButton
          action={action}
          fields={{ ...fields, [name]: selected }}
          successNotification={successNotification}
          confirm={confirm?.[selected]}
          disabled={selected === storedValue}
          onError={setError}
          pendingText="Guardando..."
        >
          Guardar
        </ConfirmActionButton>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
