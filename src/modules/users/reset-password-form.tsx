"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError } from "@/lib/notifications";
import {
  resetUserPasswordAction,
  type UserFormState,
} from "@/modules/users/actions";

type ResetPasswordFormProps = {
  idUsuario: string;
  cancelHref?: string;
};

const initialState: UserFormState = { error: "" };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function ResetPasswordForm({
  idUsuario,
  cancelHref = "/dashboard/users",
}: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    resetUserPasswordAction,
    initialState,
  );

  useEffect(() => {
    if (state.error) {
      showError(
        "No se pudo reiniciar la contraseña",
        "Revise los datos ingresados e inténtelo nuevamente.",
      );
    }
  }, [state.error]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id_usuario" value={idUsuario} />

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input id="password" name="password" type="password" required />
        <p className="text-xs text-muted-foreground">
          Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter
          especial.
        </p>
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
        />
        <FieldError messages={state.fieldErrors?.confirmPassword} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Reiniciar contraseña"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
