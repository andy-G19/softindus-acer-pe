"use client";

import { useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { calculateWaste } from "@/lib/material-reconciliation";
import type { CloseMaterialsFormState } from "@/modules/production/work-orders/actions";

export type CloseMaterialLine = {
  idRequerimiento: string;
  materialName: string;
  unidad: string;
  delivered: number;
  returned: number;
};

type CloseMaterialsFormProps = {
  idOrdenTrabajo: string;
  lines: CloseMaterialLine[];
  productUnit: string;
  /**
   * C2 de la 11.6b (D74): el estado de la accion vive en MaterialClosureSection, que queda montada
   * cuando el cierre cambia lo que muestra el detalle; este formulario solo lo pinta.
   */
  state: CloseMaterialsFormState;
  formAction: (formData: FormData) => void;
  pending: boolean;
};

export function CloseMaterialsForm({
  idOrdenTrabajo,
  lines,
  productUnit,
  state,
  formAction,
  pending,
}: CloseMaterialsFormProps) {
  // Se propone como consumo lo entregado menos lo devuelto: el caso mayoritario es que se
  // consumió todo lo que no volvió, y así el usuario solo corrige las excepciones. Vive fuera de
  // ActionForm, así que lo escrito se conserva cuando sus campos se remontan tras un error.
  const [consumed, setConsumed] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((line) => [
        line.idRequerimiento,
        Math.max(line.delivered - line.returned, 0).toFixed(2),
      ]),
    ),
  );

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  // Con éxito la sección deja de mostrar este formulario: solo un error devuelve lo enviado.
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;

  const rows = lines.map((line, index) => {
    const declared = Number(consumed[line.idRequerimiento] ?? 0);
    const waste = calculateWaste({
      delivered: line.delivered,
      consumed: declared,
      returned: line.returned,
    });

    return {
      ...line,
      declared,
      waste,
      invalid: waste < 0,
      // La acción devuelve el error de una línea por su posición en el formulario.
      errors: fieldErrors?.[`lineas.${index}.cantidad_consumida`],
    };
  });

  const hasInvalid = rows.some((row) => row.invalid);
  const totalWaste = rows.reduce(
    (total, row) => total + (row.invalid ? 0 : row.waste),
    0,
  );

  return (
    <ActionForm action={formAction} pending={pending} resultKey={resultKey} className="space-y-4">
      <input type="hidden" name="id_orden_trabajo" value={idOrdenTrabajo} />

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Material</th>
              <th className="px-3 py-2 text-right">Entregado</th>
              <th className="px-3 py-2 text-right">Devuelto</th>
              <th className="px-3 py-2 text-right">Consumido *</th>
              <th className="px-3 py-2 text-right">Merma</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              // id estable por posición: ActionForm enfoca el primer campo inválido.
              const inputId = `cantidad_consumida_${index}`;
              const errorId = `${inputId}-error`;
              const hasError = Boolean(row.errors?.length);

              return (
                <tr key={row.idRequerimiento} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.materialName}</span>
                    <input
                      type="hidden"
                      name="id_requerimiento"
                      value={row.idRequerimiento}
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    {row.delivered.toFixed(2)} {row.unidad}
                  </td>

                  <td className="px-3 py-2 text-right">
                    {row.returned.toFixed(2)}
                  </td>

                  <td className="px-3 py-2 text-right">
                    <Input
                      id={inputId}
                      name="cantidad_consumida"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      className="ml-auto w-28 text-right"
                      aria-invalid={hasError ? true : undefined}
                      aria-describedby={hasError ? errorId : undefined}
                      value={consumed[row.idRequerimiento] ?? ""}
                      onChange={(event) =>
                        setConsumed((current) => ({
                          ...current,
                          [row.idRequerimiento]: event.target.value,
                        }))
                      }
                    />
                    <FieldError id={errorId} messages={row.errors} />
                  </td>

                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      row.invalid ? "text-destructive" : ""
                    }`}
                  >
                    {row.waste.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasInvalid ? (
        <Alert variant="destructive">
          <AlertDescription>
            Hay materiales donde lo consumido más lo devuelto supera lo
            entregado. No se puede consumir material que nunca salió del
            almacén.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground">
          Merma total derivada:{" "}
          <span className="font-medium text-foreground">
            {totalWaste.toFixed(2)}
          </span>
          . No se captura: es lo entregado que no se consumió ni volvió al
          almacén.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          id="cantidad_producida"
          label={`Unidades producidas (${productUnit})`}
          required
          errors={fieldErrors?.cantidad_producida}
          description="Lo realmente fabricado. Puede ser cero si la orden falló por completo."
        >
          {(control) => (
            <Input
              {...control}
              name="cantidad_producida"
              type="number"
              min="0"
              step="0.01"
              defaultValue={values?.cantidad_producida}
              placeholder="Ej. 10"
            />
          )}
        </Field>
      </div>

      <Alert variant="warning">
        <AlertDescription>
          Al cerrar los materiales ya no se podrá entregar ni devolver contra
          esta orden.
        </AlertDescription>
      </Alert>

      <SubmitButton disabled={hasInvalid} pendingText="Cerrando materiales...">
        Cerrar materiales
      </SubmitButton>
    </ActionForm>
  );
}
