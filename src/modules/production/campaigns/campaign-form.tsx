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
import type {
  ProductionCampaignFormState,
  ProductionCampaignFormValues,
} from "@/modules/production/campaigns/actions";

type CampaignFormProps = {
  action: (prevState: ProductionCampaignFormState, formData: FormData) => Promise<ProductionCampaignFormState>;
  /** Valores iniciales; con id_campania es una edicion. */
  defaultValues: ProductionCampaignFormValues & { id_campania?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Produccion. La pagina lo pasa con
   * su clave literal (productionNotifications["campaign-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: ProductionCampaignFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

// Formulario de alta y edicion de campanas (entrega 10.7a), con el patron de Rutas.
// La accion devuelve un resultado: con error, ActionForm vuelve a mostrar lo enviado
// y enfoca el primer campo invalido, y el mensaje general queda dentro del
// formulario, sin toast; con exito, se da un solo aviso y se vuelve al listado con
// sus filtros. El estado solo se elige al crear: despues cambia desde la fila, con
// sus reglas (D2 de la 10.7).
//
// Dentro de un RouteSheet los campos van en el cuerpo desplazable y los botones en
// el pie fijo; en la pagina completa, Cancelar es un enlace al returnTo.
export function CampaignForm({ action, defaultValues, submitLabel, successNotification, returnTo }: CampaignFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);

  const idCampania = defaultValues.id_campania;
  const isNew = !idCampania;
  const isVoided = !isNew && defaultValues.estado === "anulada";

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
      {idCampania ? <input type="hidden" name="id_campania" value={idCampania} /> : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {isVoided ? (
        <Alert variant="destructive">
          <AlertDescription>Esta campaña está anulada y ya no puede modificarse.</AlertDescription>
        </Alert>
      ) : null}

      <Field
        id="nombre_campania"
        label="Nombre de la campaña"
        required
        disabled={isVoided}
        errors={fieldErrors?.nombre_campania}
      >
        {(control) => (
          <Input
            {...control}
            name="nombre_campania"
            maxLength={100}
            placeholder="Ej. Campaña escolar agosto"
            defaultValue={values.nombre_campania}
          />
        )}
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          id="fecha_inicio"
          label="Fecha de inicio"
          required
          disabled={isVoided}
          errors={fieldErrors?.fecha_inicio}
        >
          {(control) => <Input {...control} name="fecha_inicio" type="date" defaultValue={values.fecha_inicio} />}
        </Field>

        <Field id="fecha_fin" label="Fecha de fin" disabled={isVoided} errors={fieldErrors?.fecha_fin}>
          {(control) => <Input {...control} name="fecha_fin" type="date" defaultValue={values.fecha_fin} />}
        </Field>
      </div>

      {isNew ? (
        <Field id="estado" label="Estado" required errors={fieldErrors?.estado}>
          {(control) => (
            <NativeSelect {...control} name="estado" defaultValue={values.estado}>
              <option value="planificada">Planificada</option>
              <option value="activa">Activa</option>
            </NativeSelect>
          )}
        </Field>
      ) : null}

      <Field
        id="objetivo_general"
        label="Objetivo general"
        disabled={isVoided}
        errors={fieldErrors?.objetivo_general}
      >
        {(control) => (
          <Textarea
            {...control}
            name="objetivo_general"
            rows={4}
            maxLength={isNew ? 700 : undefined}
            placeholder="Ej. Fabricar lote de herramientas para reposición de stock."
            defaultValue={values.objetivo_general}
          />
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
          <SubmitButton pendingText="Guardando..." disabled={isVoided}>
            {submitLabel}
          </SubmitButton>
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
        <SubmitButton pendingText="Guardando..." disabled={isVoided}>
          {submitLabel}
        </SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
