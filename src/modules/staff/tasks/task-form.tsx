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
import { NativeSelect } from "@/components/ui/native-select";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { OperatorTaskFormState, OperatorTaskFormValues } from "@/modules/staff/tasks/actions";

type Option = { id: string; label: string; description?: string };

type TaskFormProps = {
  action: (prevState: OperatorTaskFormState, formData: FormData) => Promise<OperatorTaskFormState>;
  /** Operarios activos, ordenes no anuladas y etapas activas. */
  operators: Option[];
  workOrders: Option[];
  stages: Option[];
  defaultValues: OperatorTaskFormValues;
  /**
   * Aviso que se da al guardar, del catalogo de Personal. La pagina lo pasa con
   * su clave literal (staffNotifications["operator-task-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

type SelectField = "id_operario" | "id_orden_trabajo" | "id_etapa_ruta";

const initialState: OperatorTaskFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

// Formulario de tareas diarias (entrega 10.8a), con el patron de Asistencia. La
// accion devuelve un resultado: con error, ActionForm vuelve a mostrar lo enviado y
// enfoca el primer campo invalido, y el mensaje general queda dentro del
// formulario, sin toast; con exito, se da un solo aviso y se vuelve al listado. Lo
// elegido en los buscadores es estado local porque SearchableSelect con value es
// controlado y ActionForm remonta los campos tras un error. Las reglas de uso son
// ayudas de sus campos (D10); la de las horas dice lo que hace el codigo sin
// afirmar la unidad de la tarifa (D8). El estado inicial no ofrece anular: se anula
// desde la fila.
export function TaskForm({
  action,
  operators,
  workOrders,
  stages,
  defaultValues,
  successNotification,
  returnTo,
}: TaskFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selected, setSelected] = useState<Record<SelectField, string>>({
    id_operario: defaultValues.id_operario,
    id_orden_trabajo: defaultValues.id_orden_trabajo,
    id_etapa_ruta: defaultValues.id_etapa_ruta,
  });

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

  if (operators.length === 0 || workOrders.length === 0) {
    return (
      <EmptyState
        label="Faltan datos para registrar tareas."
        description="Debes tener al menos un operario activo y una orden de trabajo registrada o en proceso."
        action={
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href="/dashboard/staff/operators">Ver operarios</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/production/work-orders">Ver órdenes</Link>
            </Button>
          </div>
        }
      />
    );
  }

  const searchable = (
    name: SelectField,
    label: string,
    placeholder: string,
    items: Option[],
    emptyMessage: string,
    help?: string,
  ) => {
    const errors = fieldErrors?.[name];
    const describedBy = [help ? `${name}-ayuda` : null, errors?.length ? `${name}-error` : null]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="space-y-2">
        <SearchableSelect
          id={name}
          name={name}
          label={label}
          placeholder={placeholder}
          items={items}
          value={selected[name]}
          onValueChange={(value) => setSelected((current) => ({ ...current, [name]: value }))}
          required={name !== "id_etapa_ruta"}
          emptyMessage={emptyMessage}
          {...(errors?.length ? { "aria-invalid": true as const } : {})}
          {...(describedBy ? { "aria-describedby": describedBy } : {})}
        />
        {help ? (
          <p id={`${name}-ayuda`} className="text-xs text-muted-foreground">
            {help}
          </p>
        ) : null}
        <FieldError id={`${name}-error`} messages={errors} />
      </div>
    );
  };

  const fields = (
    <>
      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {searchable("id_operario", "Operario", "Buscar operario...", operators, "No hay operarios activos disponibles.")}
      {searchable(
        "id_orden_trabajo",
        "Orden de trabajo",
        "Buscar orden...",
        workOrders,
        "No hay órdenes de trabajo disponibles.",
        "La actividad queda vinculada a la orden de trabajo.",
      )}
      {searchable(
        "id_etapa_ruta",
        "Etapa de producción",
        "Buscar etapa...",
        stages,
        "No hay etapas activas disponibles.",
        "Si eliges una etapa, debe pertenecer a la ruta de fabricación de la orden.",
      )}

      <div className="grid gap-4 @md:grid-cols-3">
        <Field id="fecha_tarea" label="Fecha de tarea" required errors={fieldErrors?.fecha_tarea}>
          {(control) => <Input {...control} name="fecha_tarea" type="date" defaultValue={values.fecha_tarea} />}
        </Field>

        <Field
          id="horas_dedicadas"
          label="Horas dedicadas"
          description="Al generar un costeo, la mano de obra se estima con estas horas y la tarifa del operario."
          errors={fieldErrors?.horas_dedicadas}
        >
          {(control) => (
            <Input
              {...control}
              name="horas_dedicadas"
              type="number"
              min="0"
              max="24"
              step="0.01"
              placeholder="Ejemplo: 4.50"
              defaultValue={values.horas_dedicadas}
            />
          )}
        </Field>

        <Field id="estado" label="Estado" required errors={fieldErrors?.estado}>
          {(control) => (
            <NativeSelect {...control} name="estado" defaultValue={values.estado || "registrada"}>
              <option value="registrada">Registrada</option>
              <option value="en_proceso">En proceso</option>
              <option value="terminada">Terminada</option>
            </NativeSelect>
          )}
        </Field>
      </div>

      <Field id="descripcion" label="Descripción de la tarea" required errors={fieldErrors?.descripcion}>
        {(control) => (
          <Input
            {...control}
            name="descripcion"
            maxLength={255}
            placeholder="Ejemplo: Corte de piezas para lote de lampas"
            defaultValue={values.descripcion}
          />
        )}
      </Field>

      <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            rows={4}
            maxLength={500}
            placeholder="Ejemplo: Se avanzó parcialmente por falta de material."
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
          <SubmitButton pendingText="Guardando...">Registrar tarea</SubmitButton>
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
        <SubmitButton pendingText="Guardando...">Registrar tarea</SubmitButton>
        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
