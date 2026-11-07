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
import { calculateSuggestedPrice } from "@/lib/costing-calculations";
import { formatDateTime, formatMoney } from "@/lib/formatters";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { toNumber } from "@/lib/numbers";
import { formatCostingPercent } from "@/modules/costs/costing-format";
import { createMarginAction } from "@/modules/costs/margins/actions";
import { MarginForm } from "@/modules/costs/margins/margin-form";
import type { CostingDetail } from "@/modules/costs/costings/queries";

// Margen de ganancia: aplicar un margen sobre el costo total y su historial.

function getSuggestedPrice(totalCost: unknown, marginPercentage: number) {
  return calculateSuggestedPrice(toNumber(totalCost), marginPercentage);
}

type MarginsSectionProps = {
  costing: Pick<CostingDetail, "id_costeo" | "costo_total" | "margen_ganancia">;
  /** Aviso al aplicar un margen; la pagina lo pasa con su clave literal. */
  createdNotification: NotificationDefinition;
};

export function MarginsSection({ costing, createdNotification }: MarginsSectionProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Aplicar margen de ganancia
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Aplica un margen entre 15% y 20% sobre el costo total. El
            sistema calculará automáticamente el precio sugerido y
            permitirá registrar un precio final ajustado.
          </p>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
            <p className="font-medium text-foreground">Referencia rápida</p>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Costo total</p>
                <p className="font-semibold text-foreground">
                  {formatMoney(costing.costo_total)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Precio con 15%</p>
                <p className="font-semibold text-foreground">
                  {formatMoney(getSuggestedPrice(costing.costo_total, 15))}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Precio con 20%</p>
                <p className="font-semibold text-foreground">
                  {formatMoney(getSuggestedPrice(costing.costo_total, 20))}
                </p>
              </div>
            </div>
          </div>

          <MarginForm
            action={createMarginAction}
            idCosteo={costing.id_costeo}
            successNotification={createdNotification}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Márgenes aplicados</CardTitle>
          <p className="text-sm text-muted-foreground">
            Historial de márgenes registrados para este costeo.
          </p>
        </CardHeader>

        <CardContent className="px-0">
          {costing.margen_ganancia.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Todavía no hay márgenes aplicados para este costeo."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Margen</TableHead>
                  <TableHead>Precio sugerido</TableHead>
                  <TableHead>Precio final</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {costing.margen_ganancia.map((item) => (
                  <TableRow key={item.id_margen}>
                    <TableCell>{formatDateTime(item.fecha_aplicacion)}</TableCell>
                    <TableCell>{formatCostingPercent(item.porcentaje_margen)}</TableCell>
                    <TableCell>{formatMoney(item.precio_sugerido)}</TableCell>
                    <TableCell>
                      {item.precio_final ? formatMoney(item.precio_final) : "-"}
                    </TableCell>
                    <TableCell>{item.motivo_ajuste ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
