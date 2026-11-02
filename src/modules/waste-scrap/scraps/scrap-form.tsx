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
import { Input } from "@/components/ui/input";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { ScrapFormState, ScrapFormValues } from "@/modules/waste-scrap/scraps/actions";

type Option = {
  id: string;
  label: string;
  description?: string;
};

type ScrapFormProps = {
  action: (prevState: ScrapFormState, formData: FormData) => Promise<ScrapFormState>;
  materials: Option[];
  workOrders: Option[];
  /** Aviso del catalogo de Mermas; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: ScrapFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: ScrapFormValues = {
  id_material: "",
  id_orden_trabajo: "",
  tipo_material: "",
  peso_kg: "",
  cantidad: "",
  observaciones: "",
};

// Formulario de alta de chatarra (entrega 10.7a), con el patron de Rutas. La accion
// devuelve un resultado: con error, ActionForm vuelve a mostrar lo enviado y enfoca el
// primer campo invalido, y el mensaje general queda dentro del formulario, sin toast;
// con exito, se da un solo aviso y se vuelve al listado con sus filtros. Material y
// orden son estado del formulario: con value sobreviven al remontaje de los campos.
//
// Dentro de un RouteSheet los campos van en el cuerpo desplazable y los botones en el
// pie fijo; en la pagina completa, Cancelar es un enlace al returnTo.
export function ScrapForm({ action, materials, workOrders, successNotification, returnTo }: ScrapFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedOrder, setSelectedOrder] = useState("");

  const values = state.status === "idle" ? emptyValues : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const materialErrors = fieldErrors?.id_material;
  const orderErrors = fieldErrors?.id_orden_trabajo;
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
      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <SearchableSelect
          id="id_material"
          name="id_material"
          label="Material de origen"
          placeholder="Buscar material..."
          items={materials}
          value={selectedMaterial}
          onValueChange={setSelectedMaterial}
          emptyMessage="No hay materiales activos disponibles."
          {...(materialErrors?.length
            ? { "aria-invalid": true as const, "aria-describedby": "id_material-error" }
            : {})}
        />
        <FieldError id="id_material-error" messages={materialErrors} />

        <p className="text-xs text-muted-foreground">
          Selecciona el material si se conoce el origen. Si la chatarra está mezclada, puedes dejarlo como no
          identificado.
        </p>
      </div>

      <div className="space-y-2">
        <SearchableSelect
          id="id_orden_trabajo"
          name="id_orden_trabajo"
          label="Orden de trabajo relacionada"
          placeholder="Buscar orden..."
          items={workOrders}
          value={selectedOrder}
          onValueChange={setSelectedOrder}
          emptyMessage="No hay órdenes de trabajo disponibles."
          {...(orderErrors?.length
            ? { "aria-invalid": true as const, "aria-describedby": "id_orden_trabajo-error" }
            : {})}
        />
        <FieldError id="id_orden_trabajo-error" messages={orderErrors} />

        <p className="text-xs text-muted-foreground">
          Indica la orden que generó la chatarra. Déjalo vacío si proviene de limpieza de taller o de un origen no
          productivo.
        </p>
      </div>

      <Field
        id="tipo_material"
        label="Tipo de material"
        required
        description="Este campo ayuda a clasificar la chatarra cuando se venda o se consulte el historial."
        errors={fieldErrors?.tipo_material}
      >
        {(control) => (
          <Input
            {...control}
            name="tipo_material"
            maxLength={50}
            placeholder="Ejemplo: acero, fierro, plancha, tubo, mixto"
            defaultValue={values.tipo_material}
          />
        )}
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          id="peso_kg"
          label="Peso en kg"
          description="Recomendado cuando la chatarra se controla por peso."
          errors={fieldErrors?.peso_kg}
        >
          {(control) => (
            <Input
              {...control}
              name="peso_kg"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ejemplo: 12.50"
              defaultValue={values.peso_kg}
            />
          )}
        </Field>

        <Field
          id="cantidad"
          label="Cantidad aproximada"
          description="Útil cuando se registra por bolsas, piezas, baldes o grupos."
          errors={fieldErrors?.cantidad}
        >
          {(control) => (
            <Input
              {...control}
              name="cantidad"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ejemplo: 3"
              defaultValue={values.cantidad}
            />
          )}
        </Field>
      </div>

      <Field id="observaciones" label="Observaciones" errors={fieldErrors?.observaciones}>
        {(control) => (
          <Textarea
            {...control}
            name="observaciones"
            rows={4}
            placeholder="Ejemplo: chatarra generada durante corte de planchas para lampas"
            defaultValue={values.observaciones}
          />
        )}
      </Field>

      <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Estado inicial de la chatarra</p>
        <p className="mt-1">
          Todo registro de chatarra se guardará inicialmente con estado{" "}
          <span className="font-semibold">acumulada</span>. Cuando se registre una venta, el estado cambiará a{" "}
          <span className="font-semibold">vendida</span>.
        </p>
      </div>
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
          <SubmitButton pendingText="Guardando...">Guardar chatarra</SubmitButton>
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
        <SubmitButton pendingText="Guardando...">Guardar chatarra</SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
