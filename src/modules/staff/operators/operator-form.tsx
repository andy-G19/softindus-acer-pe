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
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { OperatorFormState, OperatorFormValues } from "@/modules/staff/operators/actions";

type OperatorFormProps = {
  action: (prevState: OperatorFormState, formData: FormData) => Promise<OperatorFormState>;
  /** Valores iniciales; con id_operario es una edicion. */
  defaultValues: OperatorFormValues & { id_operario?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Personal. La pagina lo pasa con
   * su clave literal (staffNotifications["operator-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: OperatorFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

// Formulario de alta y edicion de operarios (entrega 10.8a), con el patron de
// Usuarios. La accion devuelve un resultado: con error, ActionForm vuelve a
// mostrar lo enviado y enfoca el primer campo invalido, y el mensaje general queda
// dentro del formulario, sin toast; con exito, se da un solo aviso y se vuelve al
// listado con sus filtros. El estado no se edita aqui: el operario nace activo y
// cambia desde la fila (D3).
//
// Dentro de un RouteSheet los campos van en el cuerpo desplazable y los botones en
// el pie fijo; en la pagina completa, Cancelar es un enlace al returnTo.
export function OperatorForm({
  action,
  defaultValues,
  submitLabel,
  successNotification,
  returnTo,
}: OperatorFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const idOperario = defaultValues.id_operario;

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
      {idOperario ? <input type="hidden" name="id_operario" value={idOperario} /> : null}

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
        <Field id="cargo" label="Cargo" errors={fieldErrors?.cargo}>
          {(control) => <Input {...control} name="cargo" maxLength={50} defaultValue={values.cargo} />}
        </Field>

        <Field id="especialidad" label="Especialidad" errors={fieldErrors?.especialidad}>
          {(control) => (
            <Input {...control} name="especialidad" maxLength={80} defaultValue={values.especialidad} />
          )}
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="telefono" label="Telefono" errors={fieldErrors?.telefono}>
          {(control) => <Input {...control} name="telefono" maxLength={20} defaultValue={values.telefono} />}
        </Field>

        <Field id="fecha_ingreso" label="Fecha de ingreso" errors={fieldErrors?.fecha_ingreso}>
          {(control) => (
            <Input {...control} name="fecha_ingreso" type="date" defaultValue={values.fecha_ingreso} />
          )}
        </Field>
      </div>

      <Field id="direccion" label="Direccion" errors={fieldErrors?.direccion}>
        {(control) => <Input {...control} name="direccion" maxLength={150} defaultValue={values.direccion} />}
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="modalidad_pago" label="Modalidad de pago" required errors={fieldErrors?.modalidad_pago}>
          {(control) => (
            <NativeSelect {...control} name="modalidad_pago" defaultValue={values.modalidad_pago || "semanal"}>
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </NativeSelect>
          )}
        </Field>

        <Field id="tarifa" label="Tarifa" errors={fieldErrors?.tarifa}>
          {(control) => (
            <Input {...control} name="tarifa" type="number" min="0" step="0.01" defaultValue={values.tarifa} />
          )}
        </Field>
      </div>

      <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea {...control} name="observaciones" rows={4} maxLength={500} defaultValue={values.observaciones} />
        )}
      </Field>
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
