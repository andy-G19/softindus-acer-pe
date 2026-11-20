import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FieldErrors } from "@/lib/errors";
import { cn } from "@/lib/utils";

/** Lo que dice la alerta cuando su mensaje ya esta bajo un campo (D111 de la 11.7d2). */
export const REPEATED_FIELD_MESSAGE = "Revisa los campos marcados.";

type FormErrorAlertProps = {
  /** El estado de la accion del formulario (FormActionState): solo pinta con `status: "error"`. */
  state: { status: string; error?: string; fieldErrors?: FieldErrors };
  className?: string;
};

/**
 * La alerta general de un formulario de la pista B (C1 de la 11.7d2, hallazgo 12 de la 10.3b).
 *
 * Cuando una regla de negocio falla (un documento repetido, un nombre que ya existe), las acciones
 * mandan el mismo texto como mensaje general y como error del campo. Pintado tal cual, se veia dos
 * veces y el lector de pantalla lo leia dos veces: la alerta (`role="alert"`) y el campo que
 * ActionForm enfoca, que lleva su error en `aria-describedby`. Si el mensaje general es el de algun
 * campo, la alerta dice que hay campos que revisar; si es otro (permisos, stock, la base de datos,
 * «Revisa los datos del…»), lo muestra tal cual. La regla vive aqui y no en cada accion, para que
 * una accion nueva no pueda volver a repetirlo.
 */
export function FormErrorAlert({ state, className }: FormErrorAlertProps) {
  if (state.status !== "error" || state.error === undefined) {
    return null;
  }

  const repeatsAField = Object.values(state.fieldErrors ?? {}).some((messages) =>
    messages?.includes(state.error ?? ""),
  );

  return (
    // Diseno de mensajes y estados: un bloque granate mas compacto que la alerta, con el texto
    // rosado entero (no al 85 %) y en medio peso.
    <Alert
      variant="destructive"
      role="alert"
      aria-live="polite"
      className={cn(
        "rounded-md px-4 py-3 *:data-[slot=alert-description]:text-destructive-foreground",
        className,
      )}
    >
      <AlertDescription className="font-medium">
        {repeatsAField ? REPEATED_FIELD_MESSAGE : state.error}
      </AlertDescription>
    </Alert>
  );
}
