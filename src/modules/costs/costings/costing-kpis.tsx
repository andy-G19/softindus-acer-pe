import { CircleDollarSign, Users } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatMoney } from "@/lib/formatters";
import type { CostingDetail } from "@/modules/costs/costings/queries";

// Indicadores del costeo: materiales, consumibles, mano de obra, indirectos y total.

type CostingKpisProps = {
  costing: Pick<
    CostingDetail,
    | "costo_materiales"
    | "costo_consumibles"
    | "costo_mano_obra"
    | "costo_indirecto_total"
    | "costo_total"
    | "costo_unitario"
  >;
};

export function CostingKpis({ costing }: CostingKpisProps) {
  return (
    <section className="grid gap-4 md:grid-cols-5">
      <KpiCard title="Costo materiales" value={formatMoney(costing.costo_materiales)} description="Materia prima." tone="info" icon={CircleDollarSign} />
      <KpiCard title="Costo consumibles" value={formatMoney(costing.costo_consumibles)} description="Insumos secundarios." tone="info" icon={CircleDollarSign} />
      <KpiCard title="Mano de obra" value={formatMoney(costing.costo_mano_obra)} description="Estimada u operativa." tone="info" icon={Users} />
      <KpiCard title="Costo indirecto total" value={formatMoney(costing.costo_indirecto_total)} description="Gastos indirectos." tone="warning" icon={CircleDollarSign} />
      <KpiCard title="Costo total" value={formatMoney(costing.costo_total)} description={`Unitario: ${formatMoney(costing.costo_unitario ?? 0)}`} tone="warning" icon={CircleDollarSign} />
    </section>
  );
}
