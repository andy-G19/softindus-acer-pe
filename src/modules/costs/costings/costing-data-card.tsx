import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/formatters";
import { formatCostingDecimal } from "@/modules/costs/costing-format";
import {
  recalculateCostingAction,
  updateLaborCostAction,
} from "@/modules/costs/costings/actions";
import type { CostingDetail } from "@/modules/costs/costings/queries";

// Datos del costeo y los dos casos de uso de su mano de obra: ajustarla y recalcular.

type CostingDataCardProps = {
  costing: Pick<
    CostingDetail,
    "id_costeo" | "fecha_costeo" | "cantidad_base" | "usuario" | "costo_mano_obra"
  >;
  clientName: string | null;
};

export function CostingDataCard({ costing, clientName }: CostingDataCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Datos del costeo</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Fecha de costeo</dt>
            <dd className="font-medium">{formatDate(costing.fecha_costeo, { format: "d mmm yyyy" })}</dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Cantidad base</dt>
            <dd className="font-medium">
              {formatCostingDecimal(costing.cantidad_base)}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Registrado por</dt>
            <dd className="font-medium">
              {costing.usuario.nombres} {costing.usuario.apellidos}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Cliente</dt>
            <dd className="font-medium">{clientName ?? "-"}</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-lg border border-border/80 bg-secondary/40 p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Mano de obra y recálculo
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            La mano de obra inicial se estima desde tareas de operario con
            horas y tarifa registradas. Puedes ajustarla manualmente si
            faltan datos operativos.
          </p>

          <form
            action={updateLaborCostAction}
            className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
          >
            <input type="hidden" name="id_costeo" value={costing.id_costeo} />

            <div className="space-y-2">
              <Label htmlFor="costo_mano_obra">
                Costo de mano de obra
              </Label>
              <Input
                id="costo_mano_obra"
                name="costo_mano_obra"
                type="number"
                min="0"
                step="0.01"
                defaultValue={formatCostingDecimal(costing.costo_mano_obra)}
              />
            </div>

            <Button type="submit" className="self-end">
              Actualizar
            </Button>
          </form>

          <form action={recalculateCostingAction} className="mt-3">
            <input type="hidden" name="id_costeo" value={costing.id_costeo} />

            <Button type="submit" variant="outline">
              Recalcular costeo
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
