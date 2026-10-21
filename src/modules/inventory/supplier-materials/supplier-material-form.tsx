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
import type {
  SupplierMaterialFormState,
  SupplierMaterialFormValues,
} from "@/modules/inventory/supplier-materials/actions";

type Option = {
  id: string;
  label: string;
};

type SupplierMaterialFormProps = {
  action: (
    prevState: SupplierMaterialFormState,
    formData: FormData,
  ) => Promise<SupplierMaterialFormState>;
  suppliers: Option[];
  materials: Option[];
  /** Valores de la asociacion que se edita; en el alta, vacios. */
  defaultValues?: Partial<SupplierMaterialFormValues> & { id_proveedor_material?: string };
  submitLabel: string;
  /**
   * Aviso que se da al guardar, del catalogo de Inventario. La pagina lo pasa
   * con su clave literal (inventoryNotifications["supplier-material-created"])
   * para que notification-registry.test.ts vea quien emite cada clave.
   */
  successNotification: NotificationDefinition;
  /** Listado al que vuelve al guardar o cancelar; la pagina ya lo valido. */
  returnTo: string;
};

const initialState: SupplierMaterialFormState = { status: "idle" };

const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const emptyValues: SupplierMaterialFormValues = {
  id_proveedor: "",
  id_material: "",
  unidad_medida: "",
  precio_referencial: "",
  tiempo_entrega_dias: "",
  disponibilidad: "",
};

const availabilityOptions = [
  { value: "", label: "Sin definir" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
  { value: "no_disponible", label: "No disponible" },
];

// Formulario de alta y edicion de asociaciones proveedor-material (entrega
// 10.3b), con el patron de Clientes, Materiales y Proveedores. La accion
// devuelve un resultado: con error, ActionForm vuelve a mostrar lo enviado y
// enfoca el primer campo invalido, y el mensaje general queda dentro del
// formulario, sin toast; con exito, se da un solo aviso y se vuelve al
// listado con sus filtros. Los ids son los name de los campos.
//
// Dentro de un RouteSheet (el panel de las rutas interceptadas) los campos van
// en el cuerpo desplazable y los botones en el pie fijo; Cancelar pide cerrar
// el panel (con confirmacion si hay cambios) y guardar lo cierra volviendo
// atras. En la pagina completa, Cancelar es un enlace al returnTo y guardar
// navega a el.
export function SupplierMaterialForm({
  action,
  suppliers,
  materials,
  defaultValues,
  submitLabel,
  successNotification,
  returnTo,
}: SupplierMaterialFormProps) {
  const router = useRouter();
  const panel = useFormSurface();
  const [state, formAction, pending] = useActionState(action, initialState);
  const hasOptions = suppliers.length > 0 && materials.length > 0;

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
      {defaultValues?.id_proveedor_material ? (
        <input type="hidden" name="id_proveedor_material" value={defaultValues.id_proveedor_material} />
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasOptions ? (
        <Alert variant="warning">
          <AlertDescription>
            Deben existir proveedores y materiales activos para crear asociaciones.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 @md:grid-cols-2">
        <Field
          id="id_proveedor"
          label="Proveedor"
          required
          disabled={suppliers.length === 0}
          errors={fieldErrors?.id_proveedor}
        >
          {(control) => (
            <NativeSelect {...control} name="id_proveedor" defaultValue={values.id_proveedor}>
              <option value="">Selecciona un proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field
          id="id_material"
          label="Material"
          required
          disabled={materials.length === 0}
          errors={fieldErrors?.id_material}
        >
          {(control) => (
            <NativeSelect {...control} name="id_material" defaultValue={values.id_material}>
              <option value="">Selecciona un material</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="unidad_medida" label="Unidad de medida" required errors={fieldErrors?.unidad_medida}>
          {(control) => <Input {...control} name="unidad_medida" defaultValue={values.unidad_medida} />}
        </Field>

        <Field id="precio_referencial" label="Precio referencial" errors={fieldErrors?.precio_referencial}>
          {(control) => (
            <Input
              {...control}
              name="precio_referencial"
              type="number"
              min="0"
              step="0.01"
              defaultValue={values.precio_referencial}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field id="tiempo_entrega_dias" label="Tiempo de entrega (días)" errors={fieldErrors?.tiempo_entrega_dias}>
          {(control) => (
            <Input
              {...control}
              name="tiempo_entrega_dias"
              type="number"
              min="0"
              step="1"
              defaultValue={values.tiempo_entrega_dias}
            />
          )}
        </Field>

        <Field id="disponibilidad" label="Disponibilidad" errors={fieldErrors?.disponibilidad}>
          {(control) => (
            <NativeSelect {...control} name="disponibilidad" defaultValue={values.disponibilidad}>
              {availabilityOptions.map((option) => (
                <option key={option.value || "empty"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
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
          <SubmitButton pendingText="Guardando..." disabled={!hasOptions}>
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
        <SubmitButton pendingText="Guardando..." disabled={!hasOptions}>
          {submitLabel}
        </SubmitButton>

        <Button variant="outline" asChild>
          <Link href={returnTo}>Cancelar</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
