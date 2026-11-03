"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useMemo } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { APP_ROLES, getRoleLabel, roleLabels, type AppRole } from "@/lib/permissions";
import type { UserFormState, UserFormValues } from "@/modules/users/actions";

type UserFormProps = {
  action: (prevState: UserFormState, formData: FormData) => Promise<UserFormState>;
  /** Valores iniciales; con id_usuario es una edicion. */
  defaultValues: UserFormValues & { id_usuario?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Usuarios. La pagina lo pasa con
   * su clave literal (usersNotifications["user-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
  /**
   * El usuario editado es el de la sesion: ve su rol como texto y no puede
   * cambiarlo. La garantia real esta en updateUserAction, no aqui.
   */
  isSelf?: boolean;
};

const initialState: UserFormState = { status: "idle" };

const ROLE_OPTIONS: AppRole[] = [APP_ROLES.ADMIN, APP_ROLES.SELLER, APP_ROLES.WORKSHOP_MASTER];

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";
const PASSWORD_HINT =
  "Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial; máximo 72 (las tildes y la ñ cuentan doble).";

// Formulario de alta y edicion de usuarios (entrega 10.7b), con el patron de
// Campanas. La accion devuelve un resultado: con error, ActionForm vuelve a mostrar
// lo enviado y enfoca el primer campo invalido, y el mensaje general queda dentro
// del formulario, sin toast; con exito, se da un solo aviso y se vuelve al listado
// con sus filtros.
//
// Las contrasenas nunca vuelven del servidor (D6 de la 10.7): tras un error quedan
// vacias y se vuelven a escribir. Llevan autoComplete="new-password" para que el
// navegador no rellene la del administrador en la cuenta de otro, y usuario y
// correo autoComplete="off" por la misma razon. El estado no se edita aqui: cambia
// desde la fila (D2).
//
// Dentro de un RouteSheet los campos van en el cuerpo desplazable y los botones en
// el pie fijo; en la pagina completa, Cancelar es un enlace al returnTo.
export function UserForm({
  action,
  defaultValues,
  submitLabel,
  successNotification,
  returnTo,
  isSelf = false,
}: UserFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const idUsuario = defaultValues.id_usuario;
  const isNew = !idUsuario;

  const values = state.status === "idle" ? defaultValues : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const notification = useMemo(
    () => (hasListFilters(returnTo) ? { ...successNotification, description: FILTER_HINT } : successNotification),
    [successNotification, returnTo],
  );
  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);

  // Un aviso por operacion; en el panel lo cierra y en la pagina vuelve al listado.
  useFormResult(state, pending, { successNotification: notification, onSuccess: goBack });

  const fields = (
    <>
      {idUsuario ? <input type="hidden" name="id_usuario" value={idUsuario} /> : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="nombres" label="Nombres" required errors={fieldErrors?.nombres}>
          {(control) => <Input {...control} name="nombres" maxLength={100} defaultValue={values.nombres} />}
        </Field>

        <Field id="apellidos" label="Apellidos" required errors={fieldErrors?.apellidos}>
          {(control) => <Input {...control} name="apellidos" maxLength={100} defaultValue={values.apellidos} />}
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="usuario" label="Usuario" required errors={fieldErrors?.usuario}>
          {(control) => (
            <Input {...control} name="usuario" maxLength={50} autoComplete="off" defaultValue={values.usuario} />
          )}
        </Field>

        <Field id="correo" label="Correo electrónico" required errors={fieldErrors?.correo}>
          {(control) => (
            <Input
              {...control}
              name="correo"
              type="email"
              maxLength={100}
              autoComplete="off"
              defaultValue={values.correo}
            />
          )}
        </Field>
      </div>

      {isSelf ? (
        // Un select deshabilitado no se envia: el rol propio se muestra en un campo
        // de solo lectura sin name, asociado a su etiqueta, y viaja oculto.
        <>
          <input type="hidden" name="rol" value={values.rol} />
          <Field id="rol" label="Rol" readOnly description="No puedes cambiar tu propio rol." errors={fieldErrors?.rol}>
            {(control) => <Input {...control} value={getRoleLabel(values.rol)} readOnly />}
          </Field>
        </>
      ) : (
        <Field id="rol" label="Rol" required errors={fieldErrors?.rol}>
          {(control) => (
            <NativeSelect {...control} name="rol" defaultValue={values.rol || APP_ROLES.SELLER}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      )}

      {isNew ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id="password"
            label="Contraseña"
            required
            description={PASSWORD_HINT}
            errors={fieldErrors?.password}
          >
            {(control) => <Input {...control} name="password" type="password" autoComplete="new-password" />}
          </Field>

          <Field id="confirmPassword" label="Confirmar contraseña" required errors={fieldErrors?.confirmPassword}>
            {(control) => <Input {...control} name="confirmPassword" type="password" autoComplete="new-password" />}
          </Field>
        </div>
      ) : null}
    </>
  );

  if (panel) {
    return (
      <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="space-y-4">{fields}</SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={panel.requestClose}>
            Cancelar
          </Button>
          <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
        </SheetFooter>
      </ActionForm>
    );
  }

  return (
    <ActionForm
      action={formAction}
      pending={pending}
      resultKey={resultKey}
      className="space-y-4 rounded-lg border border-border/80 bg-card p-6"
    >
      {fields}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
