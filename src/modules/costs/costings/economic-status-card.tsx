import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/formatters";
import { formatCostingPercent } from "@/modules/costs/costing-format";
import type { CostingDetail } from "@/modules/costs/costings/queries";

// Estado economico: el ultimo margen aplicado y la ultima rentabilidad calculada.

// arr[0] tiene tipo de elemento siempre presente: se declara que puede faltar.
type EconomicStatusCardProps = {
  latestMargin: CostingDetail["margen_ganancia"][number] | undefined;
  latestProfitability: CostingDetail["rentabilidad"][number] | undefined;
};

export function EconomicStatusCard({
  latestMargin,
  latestProfitability,
}: EconomicStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estado económico</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Margen aplicado</dt>
            <dd className="font-medium">
              {latestMargin
                ? formatCostingPercent(latestMargin.porcentaje_margen)
                : "Pendiente"}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Precio sugerido</dt>
            <dd className="font-medium">
              {latestMargin
                ? formatMoney(latestMargin.precio_sugerido)
                : "Pendiente"}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Precio final</dt>
            <dd className="font-medium">
              {latestMargin?.precio_final
                ? formatMoney(latestMargin.precio_final)
                : "Pendiente"}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Utilidad estimada</dt>
            <dd className="font-medium">
              {latestProfitability
                ? formatMoney(latestProfitability.utilidad_estimada)
                : "Pendiente"}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Margen real</dt>
            <dd className="font-medium">
              {latestProfitability
                ? formatCostingPercent(latestProfitability.margen_real)
                : "Pendiente"}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="font-medium">
              {latestProfitability ? (
                <Badge
                  variant={
                    latestProfitability.alerta_bajo_margen
                      ? "destructive"
                      : "success"
                  }
                >
                  {latestProfitability.alerta_bajo_margen
                    ? "Margen bajo"
                    : "Rentable"}
                </Badge>
              ) : (
                "Pendiente"
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
