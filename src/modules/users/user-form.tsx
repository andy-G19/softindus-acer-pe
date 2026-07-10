"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { showError } from "@/lib/notifications";
import { APP_ROLES, roleLabels, type AppRole } from "@/lib/permissions";
import type { UserFormState } from "@/modules/users/actions";

type UserFormMode = "create" | "edit";

type UserFormValues = {
  id_usuario?: string;
  nombres: string;
  apellidos: string;
  usuario: string;
  correo: string;
  rol: string;
  estado?: string;
};

type UserFormProps = {
  mode: UserFormMode;
  action: (
    prevState: UserFormState,
    formData: FormData,
  ) => Promise<UserFormState>;
  defaultValues?: Partial<UserFormValues>;
  submitLabel: string;
  cancelHref?: string;
  cancelLabel?: string;
  // Verdadero cuando el usuario editado es el mismo usuario autenticado: el
  // formulario bloquea rol/estado en la UI, pero la garantia real esta en
  // el Server Action (createUserAction/updateUserAction), no aqui.
  isSelf?: boolean;
};

const initialState: UserFormState = { error: "" };
const ROLE_OPTIONS: AppRole[] = [
  APP_ROLES.ADMIN,
  APP_ROLES.SELLER,
  APP_ROLES.WORKSHOP_MASTER,
];

function getValue(
  defaultValues: Partial<UserFormValues> | undefined,
  field: keyof UserFormValues,
) {
  return defaultValues?.[field] ?? "";
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function UserForm({
  mode,
  action,
  defaultValues,
  submitLabel,
  cancelHref = "/dashboard/users",
  cancelLabel = "Cancelar",
  isSelf = false,
}: UserFormProps) {
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
    <form action={formAction} className="space-y-4">
      {defaultValues?.id_usuario ? (
        <input type="hidden" name="id_usuario" value={defaultValues.id_usuario} />
      ) : null}

      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nombres">Nombres</Label>
          <Input
            id="nombres"
            name="nombres"
            required
            defaultValue={getValue(defaultValues, "nombres")}
          />
          <FieldError messages={state.fieldErrors?.nombres} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apellidos">Apellidos</Label>
          <Input
            id="apellidos"
            name="apellidos"
            required
            defaultValue={getValue(defaultValues, "apellidos")}
          />
          <FieldError messages={state.fieldErrors?.apellidos} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="usuario">Usuario</Label>
          <Input
            id="usuario"
            name="usuario"
            required
            defaultValue={getValue(defaultValues, "usuario")}
          />
          <FieldError messages={state.fieldErrors?.usuario} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="correo">Correo electrónico</Label>
          <Input
            id="correo"
            name="correo"
            type="email"
            required
            defaultValue={getValue(defaultValues, "correo")}
          />
          <FieldError messages={state.fieldErrors?.correo} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rol">Rol</Label>
          {isSelf ? (
            // Un select "disabled" no envia su valor al hacer submit: para
            // bloquear el cambio en la UI sin romper el envio del campo, se
            // muestra el valor como texto y se manda por un input oculto. La
            // proteccion real de todos modos vive en updateUserAction.
            <>
              <input
                type="hidden"
                name="rol"
                value={getValue(defaultValues, "rol")}
              />
              <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                {roleLabels[getValue(defaultValues, "rol") as AppRole] ??
                  getValue(defaultValues, "rol")}
              </div>
              <p className="text-xs text-muted-foreground">
                No puedes cambiar tu propio rol.
              </p>
            </>
          ) : (
            <>
              <NativeSelect
                id="rol"
                name="rol"
                required
                defaultValue={getValue(defaultValues, "rol") || APP_ROLES.SELLER}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError messages={state.fieldErrors?.rol} />
            </>
          )}
        </div>

        {mode === "edit" ? (
          <div className="space-y-2">
            <Label htmlFor="estado">Estado</Label>
            {isSelf ? (
              <>
                <input type="hidden" name="estado" value="activo" />
                <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Activo
                </div>
                <p className="text-xs text-muted-foreground">
                  No puedes desactivar tu propio usuario.
                </p>
              </>
            ) : (
              <>
                <NativeSelect
                  id="estado"
                  name="estado"
                  required
                  defaultValue={getValue(defaultValues, "estado") || "activo"}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </NativeSelect>
                <FieldError messages={state.fieldErrors?.estado} />
              </>
            )}
          </div>
        ) : null}
      </div>

      {mode === "create" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required />
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter
              especial.
            </p>
            <FieldError messages={state.fieldErrors?.password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
            />
            <FieldError messages={state.fieldErrors?.confirmPassword} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
        <Button variant="outline" asChild>
          <Link href={cancelHref}>{cancelLabel}</Link>
        </Button>
      </div>
    </form>
  );
}
