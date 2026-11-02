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
import type {
  FabricationRouteFormState,
  FabricationRouteFormValues,
} from "@/modules/production/routes/actions";

type ProductOption = {
  id: string;
  label: string;
  description?: string;
};

type RouteFormProps = {
  action: (prevState: FabricationRouteFormState, formData: FormData) => Promise<FabricationRouteFormState>;
  products: ProductOption[];
  /** Valores de la ruta que se edita; en el alta, vacios. */
  defaultValues?: Partial<FabricationRouteFormValues> & { id_ruta?: string };
  /** Con ordenes asociadas el producto no se cambia: se muestra y se envia sin selector. */
  lockedProductName?: string;
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Produccion. La pagina lo pasa
   * con su clave literal (productionNotifications["route-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: FabricationRouteFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: FabricationRouteFormValues = {
  id_producto: "",
  nombre_ruta: "",
  descripcion: "",
};

// Formulario de alta y edicion de rutas de fabricacion (entrega 10.6a), con el
// patron de Productos. La accion devuelve un resultado: con error, ActionForm
// vuelve a mostrar lo enviado y enfoca el primer campo invalido, y el mensaje
// general queda dentro del formulario, sin toast; con exito, se da un solo aviso
// y se vuelve al listado con sus filtros. El producto elegido es estado del
// formulario: con value es controlado y sobrevive al remontaje de los campos.
//
// Dentro de un RouteSheet los campos van en el cuerpo desplazable y los botones
// en el pie fijo; en la pagina completa, Cancelar es un enlace al returnTo.
export function RouteForm({
  action,
  products,
  defaultValues,
  lockedProductName,
  submitLabel,
  successNotification,
  returnTo,
}: RouteFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedProduct, setSelectedProduct] = useState(defaultValues?.id_producto ?? "");

  const values = state.status === "idle" ? { ...emptyValues, ...defaultValues } : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const productErrors = fieldErrors?.id_producto;
  const isNew = !defaultValues?.id_ruta;
  const hasProducts = products.length > 0;

  const notification = useMemo(
    () => (hasListFilters(returnTo) ? { ...successNotification, description: FILTER_HINT } : successNotification),
    [successNotification, returnTo],
  );
  const goBack = useCallback(() => router.push(returnTo), [router, returnTo]);

  // Un aviso por operacion; en el panel lo cierra y en la pagina vuelve al listado.
  useFormResult(state, pending, { successNotification: notification, onSuccess: goBack });

  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const fields = (
    <>
      {defaultValues?.id_ruta ? <input type="hidden" name="id_ruta" value={defaultValues.id_ruta} /> : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasProducts ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay productos activos registrados. Primero registra productos en el módulo comercial para poder crear
            rutas de fabricación.
          </AlertDescription>
        </Alert>
      ) : null}

      {lockedProductName ? (
        <>
          <input type="hidden" name="id_producto" value={selectedProduct} />

          <Field
            id="producto_bloqueado"
            label="Producto"
            readOnly
            description="Esta ruta tiene órdenes asociadas; el producto no se puede cambiar desde datos maestros productivos."
          >
            {(control) => <Input {...control} value={lockedProductName} />}
          </Field>
        </>
      ) : (
        <div className="space-y-2">
          <SearchableSelect
            id="id_producto"
            name="id_producto"
            label="Producto"
            placeholder="Buscar producto..."
            items={products}
            value={selectedProduct}
            onValueChange={setSelectedProduct}
            required
            disabled={!hasProducts}
            emptyMessage="No hay productos activos disponibles."
            {...(productErrors?.length
              ? { "aria-invalid": true as const, "aria-describedby": "id_producto-error" }
              : {})}
          />
          <FieldError id="id_producto-error" messages={productErrors} />
        </div>
      )}

      <Field id="nombre_ruta" label="Nombre de la ruta" required errors={fieldErrors?.nombre_ruta}>
        {(control) => (
          <Input
            {...control}
            name="nombre_ruta"
            maxLength={100}
            placeholder="Ej. Ruta estándar para lampa"
            defaultValue={values.nombre_ruta}
          />
        )}
      </Field>

      <Field id="descripcion" label="Descripción" errors={fieldErrors?.descripcion}>
        {(control) => (
          <Textarea
            {...control}
            name="descripcion"
            rows={4}
            maxLength={500}
            placeholder="Ej. Corte de plancha, formado, soldadura, lijado y pintura."
            defaultValue={values.descripcion}
          />
        )}
      </Field>

      {isNew ? (
        <Alert variant="info">
          <AlertDescription>
            En esta pantalla solo registramos la ruta general. Las etapas ordenadas de la ruta se crean desde la gestión
            de etapas de cada ruta.
          </AlertDescription>
        </Alert>
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
          <SubmitButton pendingText="Guardando..." disabled={!hasProducts}>
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
        <SubmitButton pendingText="Guardando..." disabled={!hasProducts}>
          {submitLabel}
        </SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
