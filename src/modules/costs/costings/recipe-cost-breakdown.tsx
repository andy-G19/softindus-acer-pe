import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { estimateMaterialCost } from "@/lib/costing-calculations";
import { formatMoney } from "@/lib/formatters";
import { toNonNegativeNumber } from "@/lib/numbers";
import {
  formatCostingDecimal,
  formatCostingPercent,
} from "@/modules/costs/costing-format";
import type { CostingDetail } from "@/modules/costs/costings/queries";

// Desglose referencial: como se calcula el costo desde la receta de la orden y el
// costo unitario actual de cada material. Convierte la receta como la generacion
// del costeo, con toNonNegativeNumber (H6): un negativo vale 0 en las dos, y el
// desglose muestra lo que se guarda.

function getCostTypeLabel(type: string) {
  if (type === "materia_prima") {
    return "Material";
  }

  if (type === "consumible") {
    return "Consumible";
  }

  if (type === "auxiliar") {
    return "Auxiliar";
  }

  return type;
}

type RecipeCostBreakdownProps = {
  workOrder: CostingDetail["orden_trabajo"];
};

export function RecipeCostBreakdown({ workOrder }: RecipeCostBreakdownProps) {
  const materialRows =
    workOrder?.version_receta?.detalle_receta.map((detail) => {
      const quantityToProduce = toNonNegativeNumber(workOrder.cantidad);
      const quantityPerUnit = toNonNegativeNumber(detail.cantidad_requerida);
      const wastePercentage = toNonNegativeNumber(detail.merma_estimada_porcentaje);
      const unitCost = toNonNegativeNumber(detail.material.costo_unitario_actual);

      const { requiredBase, requiredWithWaste, estimatedCost } =
        estimateMaterialCost({
          quantityToProduce,
          quantityPerUnit,
          wastePercentage,
          unitCost,
        });

      return {
        id: detail.id_detalle_receta,
        materialName: detail.material.nombre_material,
        category: detail.material.categoria,
        consumptionType: detail.tipo_consumo,
        unit: detail.unidad_medida,
        quantityPerUnit,
        requiredBase,
        wastePercentage,
        requiredWithWaste,
        unitCost,
        estimatedCost,
      };
    }) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Desglose referencial</CardTitle>
        <p className="text-sm text-muted-foreground">
          Este detalle muestra cómo se calcula el costo desde la receta
          técnica y el costo unitario actual de cada material.
        </p>
      </CardHeader>

      <CardContent className="px-0">
        {materialRows.length === 0 ? (
          <EmptyState
            className="mx-6 border-0"
            label="Este costeo no tiene una orden de trabajo con receta técnica asociada."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cant. x unidad</TableHead>
                <TableHead>Requerido base</TableHead>
                <TableHead>Merma</TableHead>
                <TableHead>Requerido total</TableHead>
                <TableHead>Costo unitario</TableHead>
                <TableHead>Costo estimado</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {materialRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.materialName}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.category}
                    </p>
                  </TableCell>

                  <TableCell>{getCostTypeLabel(row.consumptionType)}</TableCell>

                  <TableCell>
                    {formatCostingDecimal(row.quantityPerUnit)} {row.unit}
                  </TableCell>

                  <TableCell>
                    {formatCostingDecimal(row.requiredBase)} {row.unit}
                  </TableCell>

                  <TableCell>{formatCostingPercent(row.wastePercentage)}</TableCell>

                  <TableCell>
                    {formatCostingDecimal(row.requiredWithWaste)} {row.unit}
                  </TableCell>

                  <TableCell>{formatMoney(row.unitCost)}</TableCell>

                  <TableCell className="font-medium">
                    {formatMoney(row.estimatedCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
