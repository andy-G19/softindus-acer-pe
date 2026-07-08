"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { showError } from "@/lib/notifications";
import type { InventoryOutputFormState } from "@/modules/inventory/movements/actions";

type Option = {
  id: string;
  label: string;
};

type InventoryOutputFormProps = {
  action: (
    prevState: InventoryOutputFormState,
    formData: FormData,
  ) => Promise<InventoryOutputFormState>;
  materials: Option[];
  workOrders: Option[];
  cancelHref?: string;
  cancelLabel?: string;
  showCancelAction?: boolean;
};

const initialState: InventoryOutputFormState = { error: "" };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function InventoryOutputForm({
  action,
  materials,
  workOrders,
  cancelHref = "/dashboard/inventory/outputs",
  cancelLabel = "Cancelar",
  showCancelAction = true,
}: InventoryOutputFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) {
      showError(
        "No se pudo completar la operación",
        "Revise los datos ingresados e inténtelo nuevamente.",
      );
    }
  }, [state.error]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-border/80 bg-card p-6"
    >
      {state.error ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="id_material">Material</Label>
          <NativeSelect id="id_material" name="id_material" required>
            <option value="">Seleccione material</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.label}
              </option>
            ))}
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.id_material} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="id_orden_trabajo">Orden de trabajo</Label>
          <NativeSelect id="id_orden_trabajo" name="id_orden_trabajo">
            <option value="">Sin orden asociada</option>
            {workOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.label}
              </option>
            ))}
          </NativeSelect>
          <FieldError messages={state.fieldErrors?.id_orden_trabajo} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cantidad">Cantidad</Label>
        <Input
          id="cantidad"
          name="cantidad"
          type="number"
          min="0.01"
          step="0.01"
          required
        />
        <FieldError messages={state.fieldErrors?.cantidad} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="motivo">Motivo</Label>
        <Textarea id="motivo" name="motivo" rows={4} required />
        <FieldError messages={state.fieldErrors?.motivo} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Registrar salida"}
        </Button>
        {showCancelAction ? (
          <Button variant="outline" asChild>
            <Link href={cancelHref}>{cancelLabel}</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
