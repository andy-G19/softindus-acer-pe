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
  TechnicalRecipeFormState,
  TechnicalRecipeFormValues,
} from "@/modules/production/recipes/actions";

type ProductOption = {
  id: string;
  label: string;
  description?: string;
};

type RecipeFormProps = {
  action: (prevState: TechnicalRecipeFormState, formData: FormData) => Promise<TechnicalRecipeFormState>;
  products: ProductOption[];
  /**
   * Aviso que se da al guardar, del catalogo de Produccion. La pagina lo pasa
   * con su clave literal (productionNotifications["recipe-created"]) para que
   * notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: TechnicalRecipeFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: TechnicalRecipeFormValues = {
  id_producto: "",
  nombre_receta: "",
  descripcion: "",
};

// Formulario de alta de recetas tecnicas (entrega 10.6b), con el patron de Rutas:
// una receta no se edita. La accion devuelve un resultado: con error, ActionForm
// vuelve a mostrar lo enviado y enfoca el primer campo invalido, y el mensaje
// general queda dentro del formulario, sin toast; con exito, se da un solo aviso
// y se vuelve al listado con sus filtros. El producto elegido es estado del
// formulario: con value es controlado y sobrevive al remontaje de los campos.
//
// Dentro de un RouteSheet los campos van en el cuerpo desplazable y los botones
// en el pie fijo; en la pagina completa, Cancelar es un enlace al returnTo.
export function RecipeForm({ action, products, successNotification, returnTo }: RecipeFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedProduct, setSelectedProduct] = useState("");

  const values = state.status === "idle" ? emptyValues : state.values;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const productErrors = fieldErrors?.id_producto;
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
      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasProducts ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay productos activos registrados. Primero registra productos en el módulo comercial para poder crear
            recetas técnicas.
          </AlertDescription>
        </Alert>
      ) : null}

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
          emptyMessage="No hay productos activos."
          {...(productErrors?.length
            ? { "aria-invalid": true as const, "aria-describedby": "id_producto-error" }
            : {})}
        />
        <p className="text-xs text-muted-foreground">
          Puedes tener más de una receta por producto siempre que el nombre de la receta sea diferente.
        </p>
        <FieldError id="id_producto-error" messages={productErrors} />
      </div>

      <Field id="nombre_receta" label="Nombre de la receta" required errors={fieldErrors?.nombre_receta}>
        {(control) => (
          <Input
            {...control}
            name="nombre_receta"
            maxLength={100}
            placeholder="Ej. Receta técnica estándar para lampa"
            defaultValue={values.nombre_receta}
          />
        )}
      </Field>

      <Field id="descripcion" label="Descripción técnica" errors={fieldErrors?.descripcion}>
        {(control) => (
          <Textarea
            {...control}
            name="descripcion"
            rows={5}
            maxLength={700}
            placeholder="Ej. Receta base para fabricar lampas metálicas considerando materiales principales, consumibles y procesos estándar."
            defaultValue={values.descripcion}
          />
        )}
      </Field>

      <Alert variant="info">
        <AlertDescription>
          En esta pantalla solo registramos la cabecera de la receta técnica. Luego agregarás la versión inicial y
          registrarás los materiales, cantidades, unidad de medida, tipo de consumo y merma estimada.
        </AlertDescription>
      </Alert>
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
            Guardar receta
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
          Guardar receta
        </SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
