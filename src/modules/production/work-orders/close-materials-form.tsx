"use client";

import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateWaste } from "@/lib/material-reconciliation";
import { closeWorkOrderMaterialsAction } from "@/modules/production/work-orders/actions";

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
};

export function CloseMaterialsForm({
  idOrdenTrabajo,
  lines,
  productUnit,
}: CloseMaterialsFormProps) {
  // Se propone como consumo lo entregado menos lo devuelto: el caso mayoritario es que se
  // consumió todo lo que no volvió, y así el usuario solo corrige las excepciones.
  const [consumed, setConsumed] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((line) => [
        line.idRequerimiento,
        Math.max(line.delivered - line.returned, 0).toFixed(2),
      ]),
    ),
  );

  const rows = lines.map((line) => {
    const declared = Number(consumed[line.idRequerimiento] ?? 0);
    const waste = calculateWaste({
      delivered: line.delivered,
      consumed: declared,
      returned: line.returned,
    });

    return { ...line, declared, waste, invalid: waste < 0 };
  });

  const hasInvalid = rows.some((row) => row.invalid);
  const totalWaste = rows.reduce(
    (total, row) => total + (row.invalid ? 0 : row.waste),
    0,
  );

  return (
    <form action={closeWorkOrderMaterialsAction} className="space-y-4">
      <input type="hidden" name="id_orden_trabajo" value={idOrdenTrabajo} />

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
            {rows.map((row) => (
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
                    name="cantidad_consumida"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="ml-auto w-28 text-right"
                    value={consumed[row.idRequerimiento] ?? ""}
                    onChange={(event) =>
                      setConsumed((current) => ({
                        ...current,
                        [row.idRequerimiento]: event.target.value,
                      }))
                    }
                  />
                </td>

                <td
                  className={`px-3 py-2 text-right font-medium ${
                    row.invalid ? "text-destructive" : ""
                  }`}
                >
                  {row.waste.toFixed(2)}
                </td>
              </tr>
            ))}
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
        <div className="space-y-2">
          <Label htmlFor="cantidad_producida">
            Unidades producidas * ({productUnit})
          </Label>
          <Input
            id="cantidad_producida"
            name="cantidad_producida"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="Ej. 10"
          />
          <p className="text-xs text-muted-foreground">
            Lo realmente fabricado. Puede ser cero si la orden falló por
            completo.
          </p>
        </div>
      </div>

      <Alert variant="warning">
        <AlertDescription>
          Al cerrar los materiales ya no se podrá entregar ni devolver contra
          esta orden.
        </AlertDescription>
      </Alert>

      <Button type="submit" disabled={hasInvalid}>
        Cerrar materiales
      </Button>
    </form>
  );
}
