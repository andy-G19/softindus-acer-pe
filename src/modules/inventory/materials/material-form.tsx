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
import type { MaterialFormState, MaterialFormValues } from "@/modules/inventory/materials/actions";

type MaterialCategoryOption = {
  slug: string;
  nombre: string;
};

type MaterialFormProps = {
  action: (prevState: MaterialFormState, formData: FormData) => Promise<MaterialFormState>;
  categories: MaterialCategoryOption[];
  /** Valores del material que se edita; en el alta, vacios. */
  defaultValues?: Partial<MaterialFormValues> & { id_material?: string };
  submitLabel: string;
  /** El alta pide el stock inicial; la edicion lo muestra sin poder cambiarlo. */
  mode: "create" | "edit";
  /**
   * Aviso que se da al guardar, del catalogo de Inventario. La pagina lo pasa
   * con su clave literal (inventoryNotifications["material-created"]) para
   * que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: MaterialFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: MaterialFormValues = {
  nombre_material: "",
  categoria: "",
  unidad_medida: "",
  stock_actual: "0",
  stock_reservado: "0",
  stock_minimo: "0",
  costo_unitario_actual: "0",
};

// Formulario de alta y edicion de materiales (entrega 10.3), con el patron de
// Clientes. La accion devuelve un resultado: con error, ActionForm vuelve a
// mostrar lo enviado y enfoca el primer campo invalido, y el mensaje general
// queda dentro del formulario, sin toast; con exito, se da un solo aviso y se
// vuelve al listado con sus filtros. Los ids son los name de los campos (useId
// cambiaria con los hermanos).
//
// Dentro de un RouteSheet (el panel de las rutas interceptadas) los campos van
// en el cuerpo desplazable y los botones en el pie fijo; Cancelar pide cerrar
// el panel (con confirmacion si hay cambios), guardar lo cierra volviendo atras
// y, mientras la accion esta pendiente, el panel no se cierra. En la pagina
// completa, Cancelar es un enlace al returnTo y guardar navega a el.
//
// El stock actual y el reservado solo se escriben en el alta: despues cambian
// con los movimientos de inventario, y la edicion los muestra de solo lectura.
export function MaterialForm({
  action,
  categories,
  defaultValues,
  submitLabel,
  mode,
  successNotification,
  returnTo,
}: MaterialFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const hasCategories = categories.length > 0;

  const values = state.status === "idle" ? { ...emptyValues, ...defaultValues } : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

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
      {defaultValues?.id_material ? (
        <input type="hidden" name="id_material" value={defaultValues.id_material} />
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasCategories ? (
        <Alert variant="info">
          <AlertDescription>
            No hay categorías de materiales activas.{" "}
            <Link href="/dashboard/inventory/material-categories">Crear categorías de materiales</Link>.
          </AlertDescription>
        </Alert>
      ) : null}

      <Field id="nombre_material" label="Nombre del material" required errors={fieldErrors?.nombre_material}>
        {(control) => (
          <Input
            {...control}
            name="nombre_material"
            placeholder="Ej. Plancha metálica 1/20"
            defaultValue={values.nombre_material}
          />
        )}
      </Field>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="categoria" label="Categoría" required disabled={!hasCategories} errors={fieldErrors?.categoria}>
          {(control) => (
            <NativeSelect {...control} name="categoria" defaultValue={values.categoria}>
              <option value="">Selecciona una categoría</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.nombre}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="unidad_medida" label="Unidad de medida" required errors={fieldErrors?.unidad_medida}>
          {(control) => (
            <Input
              {...control}
              name="unidad_medida"
              placeholder="Ej. kg, unidad, metro, plancha"
              defaultValue={values.unidad_medida}
            />
          )}
        </Field>
      </div>

      {mode === "create" ? (
        <div className="grid gap-4 @md:grid-cols-2">
          <Field id="stock_actual" label="Stock actual" required errors={fieldErrors?.stock_actual}>
            {(control) => (
              <Input
                {...control}
                name="stock_actual"
                type="number"
                step="0.01"
                min="0"
                defaultValue={values.stock_actual}
              />
            )}
          </Field>

          <Field id="stock_reservado" label="Stock reservado" required errors={fieldErrors?.stock_reservado}>
            {(control) => (
              <Input
                {...control}
                name="stock_reservado"
                type="number"
                step="0.01"
                min="0"
                defaultValue={values.stock_reservado}
              />
            )}
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 @md:grid-cols-2">
          <div className="space-y-2">
            <span className="text-sm font-medium">Stock actual</span>
            <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm">
              {defaultValues?.stock_actual || "0.00"}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Stock reservado</span>
            <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm">
              {defaultValues?.stock_reservado || "0.00"}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="stock_minimo" label="Stock mínimo" required errors={fieldErrors?.stock_minimo}>
          {(control) => (
            <Input
              {...control}
              name="stock_minimo"
              type="number"
              step="0.01"
              min="0"
              defaultValue={values.stock_minimo}
            />
          )}
        </Field>

        <Field id="costo_unitario_actual" label="Costo unitario actual" required errors={fieldErrors?.costo_unitario_actual}>
          {(control) => (
            <Input
              {...control}
              name="costo_unitario_actual"
              type="number"
              step="0.01"
              min="0"
              defaultValue={values.costo_unitario_actual}
            />
          )}
        </Field>
      </div>
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
          <SubmitButton pendingText="Guardando..." disabled={!hasCategories}>
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
      className="@container space-y-4 rounded-lg border border-border/80 bg-card p-6"
    >
      {fields}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Guardando..." disabled={!hasCategories}>
          {submitLabel}
        </SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
