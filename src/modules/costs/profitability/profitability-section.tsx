import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { calculateProfitability } from "@/lib/costing-calculations";
import { formatDateTime, formatMoney } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import { formatCostingPercent } from "@/modules/costs/costing-format";
import {
  createProfitabilityAction,
} from "@/modules/costs/profitability/actions";
import type { CostingDetail } from "@/modules/costs/costings/queries";

// Rentabilidad: vista previa con el ultimo margen, calculo y su historial. La vista
// previa usa el mismo calculo que guarda la accion (lib/costing-calculations.ts).

function getProfitabilityReference(
  totalCost: unknown,
  price: unknown,
  expectedMargin: unknown,
) {
  const income = toNumber(price);
  const cost = toNumber(totalCost);
  const expected = toNumber(expectedMargin);

  if (income <= 0 || cost <= 0) {
    return {
      income: 0,
      profit: 0,
      realMargin: 0,
      lowMarginAlert: true,
    };
  }

  const { profit, realMargin, lowMarginAlert } = calculateProfitability({
    income,
    totalCost: cost,
    expectedMargin: expected,
  });

  return {
    income,
    profit,
    realMargin,
    lowMarginAlert,
  };
}

type ProfitabilitySectionProps = {
  costing: Pick<CostingDetail, "id_costeo" | "costo_total" | "rentabilidad">;
  // arr[0] tiene tipo de elemento siempre presente: se declara que puede faltar.
  latestMargin: CostingDetail["margen_ganancia"][number] | undefined;
};

export function ProfitabilitySection({
  costing,
  latestMargin,
}: ProfitabilitySectionProps) {
  const profitabilityReference = latestMargin
    ? getProfitabilityReference(
        costing.costo_total,
        latestMargin.precio_final ?? latestMargin.precio_sugerido,
        latestMargin.porcentaje_margen,
      )
    : null;

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calcular rentabilidad</CardTitle>
          <p className="text-sm text-muted-foreground">
            Calcula la utilidad estimada comparando el ingreso esperado
            contra el costo total del costeo.
          </p>
        </CardHeader>

        <CardContent>
          {!latestMargin ? (
            <Alert variant="warning">
              <AlertDescription>
                Primero debes aplicar un margen de ganancia para obtener un
                precio sugerido o precio final.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
                <p className="font-medium text-foreground">
                  Vista previa de rentabilidad
                </p>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Ingreso estimado</p>
                    <p className="font-semibold text-foreground">
                      {formatMoney(profitabilityReference?.income ?? 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Costo total</p>
                    <p className="font-semibold text-foreground">
                      {formatMoney(costing.costo_total)}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Utilidad estimada</p>
                    <p className="font-semibold text-foreground">
                      {formatMoney(profitabilityReference?.profit ?? 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Margen real</p>
                    <p className="font-semibold text-foreground">
                      {formatCostingPercent(profitabilityReference?.realMargin)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Badge
                    variant={
                      profitabilityReference?.lowMarginAlert
                        ? "destructive"
                        : "success"
                    }
                  >
                    {profitabilityReference?.lowMarginAlert
                      ? "Margen bajo"
                      : "Rentable"}
                  </Badge>
                </div>
              </div>

              <form
                action={createProfitabilityAction}
                className="mt-5 space-y-4"
              >
                <input
                  type="hidden"
                  name="id_costeo"
                  value={costing.id_costeo}
                />

                <div className="space-y-2">
                  <Label htmlFor="observaciones_rentabilidad">
                    Observaciones
                  </Label>
                  <Textarea
                    id="observaciones_rentabilidad"
                    name="observaciones"
                    rows={3}
                    placeholder="Ejemplo: Rentabilidad aceptable según margen comercial aplicado."
                  />
                </div>

                <Button type="submit">Calcular rentabilidad</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Historial de rentabilidad
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Últimos cálculos de utilidad y margen real asociados al costeo.
          </p>
        </CardHeader>

        <CardContent className="px-0">
          {costing.rentabilidad.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Todavía no hay cálculos de rentabilidad registrados para este costeo."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Utilidad</TableHead>
                  <TableHead>Margen real</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {costing.rentabilidad.map((item) => (
                  <TableRow key={item.id_rentabilidad}>
                    <TableCell>{formatDateTime(item.fecha_calculo)}</TableCell>
                    <TableCell>{formatMoney(item.ingreso_estimado)}</TableCell>
                    <TableCell>{formatMoney(item.costo_total)}</TableCell>
                    <TableCell>{formatMoney(item.utilidad_estimada)}</TableCell>
                    <TableCell>{formatCostingPercent(item.margen_real)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.alerta_bajo_margen ? "destructive" : "success"
                        }
                      >
                        {item.alerta_bajo_margen ? "Margen bajo" : "Rentable"}
                      </Badge>
                    </TableCell>
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
