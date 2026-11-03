"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { ResetPasswordFormState } from "@/modules/users/actions";

type ResetPasswordFormProps = {
  action: (prevState: ResetPasswordFormState, formData: FormData) => Promise<ResetPasswordFormState>;
  idUsuario: string;
  /** Aviso del catalogo de Usuarios; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
};

const initialState: ResetPasswordFormState = { status: "idle" };

const PASSWORD_HINT =
  "Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial; máximo 72 (las tildes y la ñ cuentan doble).";

// Formulario de la ventana: los campos en el cuerpo y los botones en el pie. Las
// contrasenas no tienen defaultValue: nunca vuelven del servidor (D6 de la 10.7) y
// tras un error se escriben de nuevo. Con exito, un solo aviso y la ventana se
// cierra; Radix desmonta su contenido, asi que lo escrito sale del DOM.
function ResetPasswordForm({ action, idUsuario, successNotification }: ResetPasswordFormProps) {
  const surface = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  useFormResult(state, pending, { successNotification });

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-4">
        <input type="hidden" name="id_usuario" value={idUsuario} />

        {state.status === "error" ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Alert variant="warning">
          <AlertDescription>
            La contraseña anterior deja de funcionar de inmediato. Las sesiones que este usuario ya tiene abiertas no
            se cierran. Para cerrarlas, desactívalo.
          </AlertDescription>
        </Alert>

        <Field id="password" label="Nueva contraseña" required description={PASSWORD_HINT} errors={fieldErrors?.password}>
          {(control) => <Input {...control} name="password" type="password" autoComplete="new-password" />}
        </Field>

        <Field
          id="confirmPassword"
          label="Confirmar nueva contraseña"
          required
          errors={fieldErrors?.confirmPassword}
        >
          {(control) => <Input {...control} name="confirmPassword" type="password" autoComplete="new-password" />}
        </Field>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => surface?.requestClose()}>
          Cancelar
        </Button>
        <SubmitButton pendingText="Guardando...">Restablecer contraseña</SubmitButton>
      </DialogFooter>
    </ActionForm>
  );
}

type ResetPasswordDialogProps = ResetPasswordFormProps & {
  nombre: string;
  correo: string;
};

// Restablecer la contrasena de un usuario en ventana modal, desde su fila (entrega
// 10.7b). Sustituye a la pagina users/[id]/reset-password (D3 de la 10.7): el
// formulario tiene dos campos y solo se llega a el desde este boton.
export function ResetPasswordDialog({ nombre, correo, ...formProps }: ResetPasswordDialogProps) {
  return (
    <FormDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          Resetear contraseña
        </Button>
      }
      title="Restablecer contraseña"
      description={`${nombre} · ${correo}`}
      discardTitle="¿Descartar la contraseña nueva?"
      discardDescription="Se perderá lo que escribiste en esta ventana."
    >
      <ResetPasswordForm {...formProps} />
    </FormDialog>
  );
}
