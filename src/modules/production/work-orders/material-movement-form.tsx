"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  deliverAdditionalMaterialAction,
  returnWorkOrderMaterialAction,
} from "@/modules/production/work-orders/actions";

export type MaterialMovementOption = {
  idRequerimiento: string;
  materialName: string;
  unidad: string;
  /** Stock disponible hoy en almacén, para la entrega adicional. */
  stockActual: number;
  /** Lo entregado que aún no se devolvió: tope de una devolución. */
  returnable: number;
};

type MaterialMovementFormProps = {
  idOrdenTrabajo: string;
  options: MaterialMovementOption[];
};

type Mode = "adicional" | "devolucion";

export function MaterialMovementForm({
  idOrdenTrabajo,
  options,
}: MaterialMovementFormProps) {
  const [mode, setMode] = useState<Mode>("adicional");
  const [idRequerimiento, setIdRequerimiento] = useState(
    options[0]?.idRequerimiento ?? "",
  );

  const selected = options.find(
    (option) => option.idRequerimiento === idRequerimiento,
  );

  const isReturn = mode === "devolucion";
  const limit = isReturn ? selected?.returnable ?? 0 : selected?.stockActual ?? 0;
  const limitLabel = isReturn
    ? "Sin devolver de lo entregado"
    : "Stock disponible en almacén";

  return (
    <form
      action={
        isReturn ? returnWorkOrderMaterialAction : deliverAdditionalMaterialAction
      }
      className="space-y-4"
    >
      <input type="hidden" name="id_orden_trabajo" value={idOrdenTrabajo} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="movimiento_modo">Operación</Label>
          <NativeSelect
            id="movimiento_modo"
            value={mode}
            onChange={(event) => setMode(event.target.value as Mode)}
          >
            <option value="adicional">Entrega adicional</option>
            <option value="devolucion">Devolución al almacén</option>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            {isReturn
              ? "Material entregado que vuelve al almacén sin usarse."
              : "Material extra por encima de lo planificado."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="id_requerimiento">Material</Label>
          <NativeSelect
            id="id_requerimiento"
            name="id_requerimiento"
            value={idRequerimiento}
            onChange={(event) => setIdRequerimiento(event.target.value)}
            required
          >
            {options.map((option) => (
              <option
                key={option.idRequerimiento}
                value={option.idRequerimiento}
              >
                {option.materialName}
              </option>
            ))}
          </NativeSelect>
          {selected ? (
            <p className="text-xs text-muted-foreground">
              {limitLabel}:{" "}
              <span className="font-medium text-foreground">
                {limit.toFixed(2)} {selected.unidad}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cantidad">Cantidad *</Label>
        <Input
          id="cantidad"
          name="cantidad"
          type="number"
          min="0.01"
          step="0.01"
          max={limit > 0 ? limit : undefined}
          required
          placeholder="Ej. 2.50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="motivo">
          {isReturn ? "Motivo (opcional)" : "Motivo *"}
        </Label>
        <Textarea
          id="motivo"
          name="motivo"
          rows={3}
          maxLength={300}
          required={!isReturn}
          placeholder={
            isReturn
              ? "Ej. sobró material del corte."
              : "Ej. se malogró una pieza durante el forjado y hubo que rehacerla."
          }
        />
        <p className="text-xs text-muted-foreground">
          {isReturn
            ? "Ayuda a entender la devolución, pero no es obligatorio."
            : "Obligatorio: una salida por encima del plan sin explicación es imposible de auditar después."}
        </p>
      </div>

      <Button type="submit" variant={isReturn ? "outline" : "default"}>
        {isReturn ? "Registrar devolución" : "Registrar entrega adicional"}
      </Button>
    </form>
  );
}
