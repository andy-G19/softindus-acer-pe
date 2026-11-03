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
import { NativeSelect } from "@/components/ui/native-select";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import { hasListFilters } from "@/lib/navigation";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type {
  ReusableScrapFormState,
  ReusableScrapFormValues,
} from "@/modules/waste-scrap/reusable-scraps/actions";

type Option = {
  id: string;
  label: string;
  description?: string;
};

type ReusableScrapFormProps = {
  action: (prevState: ReusableScrapFormState, formData: FormData) => Promise<ReusableScrapFormState>;
  materials: Option[];
  workOrders: Option[];
  /** Aviso del catalogo de Mermas; la pagina lo pasa con su clave literal. */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: ReusableScrapFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: ReusableScrapFormValues = {
  id_material: "",
  id_orden_trabajo: "",
  medida_aproximada: "",
  cantidad: "",
  unidad_medida: "",
  ubicacion: "",
};

// Formulario de alta de retazos (entrega 10.7a), con el patron de Chatarra. La accion
// devuelve un resultado: con error, ActionForm vuelve a mostrar lo enviado y enfoca el
// primer campo invalido, y el mensaje general queda dentro del formulario, sin toast;
// con exito, se da un solo aviso y se vuelve al listado con sus filtros. Material y
// orden son estado del formulario: con value sobreviven al remontaje de los campos.
//
// Dentro de un RouteSheet los campos van en el cuerpo desplazable y los botones en el
// pie fijo; en la pagina completa, Cancelar es un enlace al returnTo.
export function ReusableScrapForm({
  action,
  materials,
  workOrders,
  successNotification,
  returnTo,
}: ReusableScrapFormProps) {
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
  const hasMaterials = materials.length > 0;

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

      {!hasMaterials ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay materiales activos. Primero registra materiales o insumos en el módulo de inventario.
          </AlertDescription>
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
          required
          disabled={!hasMaterials}
          emptyMessage="No hay materiales activos disponibles."
          {...(materialErrors?.length
            ? { "aria-invalid": true as const, "aria-describedby": "id_material-error" }
            : {})}
        />
        <FieldError id="id_material-error" messages={materialErrors} />

        <p className="text-xs text-muted-foreground">
          El tipo de material del retazo se tomará automáticamente desde la categoría del material seleccionado.
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
          required
          emptyMessage="No hay órdenes de trabajo disponibles."
          {...(orderErrors?.length
            ? { "aria-invalid": true as const, "aria-describedby": "id_orden_trabajo-error" }
            : {})}
        />
        <FieldError id="id_orden_trabajo-error" messages={orderErrors} />

        <p className="text-xs text-muted-foreground">
          Todo retazo debe quedar asociado a la orden de trabajo que lo generó.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="medida_aproximada" label="Medida aproximada" errors={fieldErrors?.medida_aproximada}>
          {(control) => (
            <Input
              {...control}
              name="medida_aproximada"
              maxLength={80}
              placeholder="Ejemplo: 30 cm x 15 cm"
              defaultValue={values.medida_aproximada}
            />
          )}
        </Field>

        <Field id="ubicacion" label="Ubicación física" errors={fieldErrors?.ubicacion}>
          {(control) => (
            <Input
              {...control}
              name="ubicacion"
              maxLength={100}
              placeholder="Ejemplo: Estante A, zona de corte"
              defaultValue={values.ubicacion}
            />
          )}
        </Field>

        <Field id="cantidad" label="Cantidad" required errors={fieldErrors?.cantidad}>
          {(control) => (
            <Input
              {...control}
              name="cantidad"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ejemplo: 2"
              defaultValue={values.cantidad}
            />
          )}
        </Field>

        <Field id="unidad_medida" label="Unidad de medida" required errors={fieldErrors?.unidad_medida}>
          {(control) => (
            <NativeSelect {...control} name="unidad_medida" defaultValue={values.unidad_medida}>
              <option value="" disabled>
                Selecciona una unidad
              </option>
              <option value="unidad">Unidad</option>
              <option value="kg">Kg</option>
              <option value="metro">Metro</option>
              <option value="plancha">Plancha</option>
              <option value="pieza">Pieza</option>
            </NativeSelect>
          )}
        </Field>
      </div>

      <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Estado inicial del retazo</p>
        <p className="mt-1">
          Todo retazo registrado se guardará inicialmente con estado <span className="font-semibold">disponible</span>.
          Podrás marcarlo como reutilizado o descartado desde la lista.
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
          <SubmitButton pendingText="Guardando..." disabled={!hasMaterials}>
            Guardar retazo
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
        <SubmitButton pendingText="Guardando..." disabled={!hasMaterials}>
          Guardar retazo
        </SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
