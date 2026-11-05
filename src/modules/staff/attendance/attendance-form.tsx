"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useMemo, useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { AttendanceFormState, AttendanceFormValues } from "@/modules/staff/attendance/actions";

type OperatorOption = { id: string; label: string; description?: string };

type AttendanceFormProps = {
  action: (prevState: AttendanceFormState, formData: FormData) => Promise<AttendanceFormState>;
  /** Operarios activos: los unicos que pueden registrar asistencia. */
  operators: OperatorOption[];
  defaultValues: AttendanceFormValues;
  /**
   * Aviso que se da al guardar, del catalogo de Personal. La pagina lo pasa con
   * su clave literal (staffNotifications["attendance-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: AttendanceFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

// Formulario de asistencia (entrega 10.8a), con el patron de Fallas. La accion
// devuelve un resultado: con error, ActionForm vuelve a mostrar lo enviado y enfoca
// el primer campo invalido, y el mensaje general queda dentro del formulario, sin
// toast; con exito, se da un solo aviso y se vuelve al listado. El operario elegido
// es estado local porque SearchableSelect con value es controlado y ActionForm
// remonta los campos tras un error. Las reglas de uso, que la pagina mostraba en
// una tarjeta lateral, son ayudas de sus campos (D10): el panel tambien las ve.
export function AttendanceForm({
  action,
  operators,
  defaultValues,
  successNotification,
  returnTo,
}: AttendanceFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedOperator, setSelectedOperator] = useState(defaultValues.id_operario);

  const values = state.status === "idle" ? defaultValues : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const operatorErrors = fieldErrors?.id_operario;
  const absenceErrors = fieldErrors?.falta;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const notification = useMemo(
    () => (hasListFilters(returnTo) ? { ...successNotification, description: FILTER_HINT } : successNotification),
    [successNotification, returnTo],
  );
  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);

  // Un aviso por operacion; en el panel lo cierra y en la pagina vuelve al listado.
  useFormResult(state, pending, { successNotification: notification, onSuccess: goBack });

  if (operators.length === 0) {
    return (
      <EmptyState
        label="No hay operarios activos disponibles."
        description="Primero registra o activa operarios para poder controlar su asistencia."
        action={
          <Button asChild>
            <Link href="/dashboard/staff/operators">Ir a operarios</Link>
          </Button>
        }
      />
    );
  }

  const fields = (
    <>
      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm text-muted-foreground">Las asistencias sin falta cuentan en la planilla del operario.</p>

      <div className="space-y-2">
        <SearchableSelect
          id="id_operario"
          name="id_operario"
          label="Operario"
          placeholder="Buscar operario..."
          items={operators}
          value={selectedOperator}
          onValueChange={setSelectedOperator}
          required
          emptyMessage="No hay operarios activos disponibles."
          {...(operatorErrors?.length
            ? { "aria-invalid": true as const, "aria-describedby": "id_operario-ayuda id_operario-error" }
            : { "aria-describedby": "id_operario-ayuda" })}
        />
        <p id="id_operario-ayuda" className="text-xs text-muted-foreground">
          Cada operario solo puede tener un registro de asistencia por día.
        </p>
        <FieldError id="id_operario-error" messages={operatorErrors} />
      </div>

      <div className="grid gap-4 @md:grid-cols-3">
        <Field id="fecha" label="Fecha" required errors={fieldErrors?.fecha}>
          {(control) => <Input {...control} name="fecha" type="date" defaultValue={values.fecha} />}
        </Field>

        <Field id="hora_ingreso" label="Hora de ingreso" errors={fieldErrors?.hora_ingreso}>
          {(control) => <Input {...control} name="hora_ingreso" type="time" defaultValue={values.hora_ingreso} />}
        </Field>

        <Field
          id="hora_salida"
          label="Hora de salida"
          description="Con ingreso y salida se calculan las horas trabajadas."
          errors={fieldErrors?.hora_salida}
        >
          {(control) => <Input {...control} name="hora_salida" type="time" defaultValue={values.hora_salida} />}
        </Field>
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm">
          <input id="tardanza" name="tardanza" type="checkbox" className="mt-1" defaultChecked={values.tardanza} />

          <span>
            <span className="block font-medium">Marcar tardanza</span>
            <span className="text-muted-foreground">Úsalo cuando el operario ingresó fuera del horario esperado.</span>
          </span>
        </label>

        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm">
            <input
              id="falta"
              name="falta"
              type="checkbox"
              className="mt-1"
              defaultChecked={values.falta}
              {...(absenceErrors?.length ? { "aria-invalid": true as const, "aria-describedby": "falta-error" } : {})}
            />

            <span>
              <span className="block font-medium">Marcar falta</span>
              <span className="text-muted-foreground">Si marcas falta, deja vacías las horas de ingreso y salida.</span>
            </span>
          </label>
          <FieldError id="falta-error" messages={absenceErrors} />
        </div>
      </div>

      <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            rows={4}
            maxLength={500}
            placeholder="Ejemplo: Llegó tarde por transporte, permiso, salida anticipada, etc."
            defaultValue={values.observaciones}
          />
        )}
      </Field>
    </>
  );

  if (panel) {
    return (
      <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="@container space-y-4">{fields}</SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={panel.requestClose}>
            Cancelar
          </Button>
          <SubmitButton pendingText="Guardando...">Registrar asistencia</SubmitButton>
        </SheetFooter>
      </ActionForm>
    );
  }

  return (
    <ActionForm
      action={formAction}
      pending={pending}
      resultKey={resultKey}
      className="@container space-y-4 rounded-lg border border-border/80 bg-card p-6"
    >
      {fields}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Guardando...">Registrar asistencia</SubmitButton>
        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
