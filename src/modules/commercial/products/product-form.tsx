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
import type { ProductFormState, ProductFormValues } from "@/modules/commercial/products/actions";

type ProductCategoryOption = {
  slug: string;
  nombre: string;
};

type ProductFormProps = {
  action: (prevState: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  categories: ProductCategoryOption[];
  /** Valores del producto que se edita; en el alta, vacios. */
  defaultValues?: Partial<ProductFormValues> & { id_producto?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Comercial. La pagina lo pasa
   * con su clave literal (commercialNotifications["product-created"]) para
   * que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: ProductFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: ProductFormValues = {
  nombre_producto: "",
  categoria: "",
  unidad_medida: "",
  precio_referencial: "",
  descripcion: "",
};

const unitOptions = [
  { value: "unidad", label: "Unidad" },
  { value: "docena", label: "Docena" },
  { value: "par", label: "Par" },
  { value: "lote", label: "Lote" },
];

// Formulario de alta y edicion de productos (entrega 10.4a), con el patron de
// Clientes, Materiales y Proveedores. La accion devuelve un resultado: con
// error, ActionForm vuelve a mostrar lo enviado y enfoca el primer campo
// invalido, y el mensaje general queda dentro del formulario, sin toast; con
// exito, se da un solo aviso y se vuelve al listado con sus filtros. Los ids
// son los name de los campos (useId cambiaria con los hermanos).
//
// Dentro de un RouteSheet (el panel de las rutas interceptadas) los campos van
// en el cuerpo desplazable y los botones en el pie fijo; Cancelar pide cerrar
// el panel (con confirmacion si hay cambios), guardar lo cierra volviendo atras
// y, mientras la accion esta pendiente, el panel no se cierra. En la pagina
// completa, Cancelar es un enlace al returnTo y guardar navega a el.
export function ProductForm({
  action,
  categories,
  defaultValues,
  submitLabel,
  successNotification,
  returnTo,
}: ProductFormProps) {
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
      {defaultValues?.id_producto ? (
        <input type="hidden" name="id_producto" value={defaultValues.id_producto} />
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasCategories ? (
        <Alert variant="info">
          <AlertDescription>
            No hay categorías activas disponibles.{" "}
            <Link href="/dashboard/commercial/product-categories">
              Crear categorías de productos
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <Field id="nombre_producto" label="Nombre del producto" required errors={fieldErrors?.nombre_producto}>
        {(control) => (
          <Input
            {...control}
            name="nombre_producto"
            placeholder="Ejemplo: Lampa agrícola reforzada"
            defaultValue={values.nombre_producto}
          />
        )}
      </Field>

      <Field
        id="categoria"
        label="Categoría"
        required
        disabled={!hasCategories}
        errors={fieldErrors?.categoria}
      >
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
          <NativeSelect {...control} name="unidad_medida" defaultValue={values.unidad_medida || "unidad"}>
            {unitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field
        id="precio_referencial"
        label="Precio referencial"
        description="Este precio es referencial. Más adelante se calculará mejor con el módulo de costos."
        errors={fieldErrors?.precio_referencial}
      >
        {(control) => (
          <Input
            {...control}
            name="precio_referencial"
            type="number"
            step="0.01"
            min="0"
            placeholder="Ejemplo: 35.00"
            defaultValue={values.precio_referencial}
          />
        )}
      </Field>

      <Field id="descripcion" label="Descripción" errors={fieldErrors?.descripcion}>
        {(control) => (
          <Textarea
            {...control}
            name="descripcion"
            placeholder="Describe características principales del producto."
            className="min-h-24"
            defaultValue={values.descripcion}
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
      className="space-y-4 rounded-lg border border-border/80 bg-card p-6"
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
