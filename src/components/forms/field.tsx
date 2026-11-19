import { useId, type ReactNode } from "react";
import { CircleAlert, Lock } from "lucide-react";

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
};

// Diseno de los campos (2026-11-19): 12 px en el rojo de los bordes de error,
// medio peso y un icono de alerta que el lector no anuncia. El id lo asocia
// con su control.
export function FieldError({ id, messages }: FieldErrorProps) {
  if (!messages?.length) {
    return null;
  }

  return (
    <p id={id} className="flex items-start gap-1.5 text-xs font-medium text-destructive-outline">
      <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      {messages[0]}
    </p>
  );
}

// Chip de solo lectura (diseno de los campos): visual, porque el lector ya
// anuncia el readonly del control.
function ReadOnlyChip() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-1 font-mono text-[0.625rem] tracking-wider text-readonly-foreground uppercase"
    >
      <Lock className="size-3" />
      Solo lectura
    </span>
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
      className={cn("group space-y-1.5", className)}
    >
      <Label htmlFor={id} className="gap-0.5 text-[0.8125rem]">
        {label}
        {/* El asterisco es visual: el lector anuncia el required del control. Cobre, no
            rojo, para no parecer un error. */}
        {required ? (
          <span aria-hidden="true" className="font-semibold text-accent-copper">
            *
          </span>
        ) : null}
      </Label>
      {children(control)}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {readOnly ? (
            <>
              <ReadOnlyChip />
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          {description}
        </p>
      ) : readOnly ? (
        <p className="text-xs">
          <ReadOnlyChip />
        </p>
      ) : null}
      <FieldError id={errorId} messages={errors} />
    </div>
  );
}
