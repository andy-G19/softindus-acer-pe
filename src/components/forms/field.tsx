import { useId, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Campo de formulario compartido (entrega 8): une la etiqueta, la ayuda y el
// error con su control para que el lector de pantalla los anuncie juntos.
//
// El control llega por una funcion hija que recibe sus props: el formulario ve
// que se le pasa y nada se sobrescribe en silencio (con Slot o cloneElement,
// un aria-describedby propio del hijo borraria la asociacion con el error).

/** Props que Field entrega a su control: se esparcen sobre Input, NativeSelect o Textarea. */
export type FieldControlProps = {
  id: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

type FieldErrorProps = {
  id?: string;
  /** Mensajes de Zod del campo (state.fieldErrors?.campo); se muestra el primero. */
  messages?: string[];
  /** "sm" es el tamano de los formularios en linea de los catalogos. */
  size?: "default" | "sm";
};

// Mismo HTML que las copias locales de los formularios, mas el id que lo
// asocia con su control.
export function FieldError({ id, messages, size = "default" }: FieldErrorProps) {
  if (!messages?.length) {
    return null;
  }

  return (
    <p id={id} className={cn(size === "sm" ? "text-xs" : "text-sm", "text-destructive")}>
      {messages[0]}
    </p>
  );
}

type FieldProps = {
  /** id del control; si falta se genera uno. En las pantallas suele ser el name. */
  id?: string;
  label: ReactNode;
  /** Ayuda bajo el control. */
  description?: ReactNode;
  /** Mensajes de error del campo (state.fieldErrors?.campo). */
  errors?: string[];
  required?: boolean;
  disabled?: boolean;
  /** Para listas no sirve: HTML ignora readonly en un select (ver la galeria). */
  readOnly?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

export function Field({
  id: idProp,
  label,
  description,
  errors,
  required,
  disabled,
  readOnly,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const descriptionId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errors?.length);

  // Solo se nombran los elementos que existen: un id sin elemento confunde al
  // lector de pantalla.
  const describedBy = [description ? descriptionId : null, hasError ? errorId : null]
    .filter(Boolean)
    .join(" ");

  const control: FieldControlProps = {
    id,
    required,
    disabled,
    readOnly,
    "aria-invalid": hasError ? true : undefined,
    "aria-describedby": describedBy || undefined,
  };

  return (
    <div
      data-slot="field"
      data-disabled={disabled ? "true" : undefined}
      className={cn("group space-y-2", className)}
    >
      <Label htmlFor={id} className="gap-1">
        {label}
        {/* El asterisco es visual: el lector anuncia el required del control. */}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </Label>
      {children(control)}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      <FieldError id={errorId} messages={errors} />
    </div>
  );
}
