import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { CostingDataCard } from "@/modules/costs/costings/costing-data-card";
import { CostingKpis } from "@/modules/costs/costings/costing-kpis";
import { EconomicStatusCard } from "@/modules/costs/costings/economic-status-card";
import { RecipeCostBreakdown } from "@/modules/costs/costings/recipe-cost-breakdown";
import { getCostingDetail } from "@/modules/costs/costings/queries";
import { IndirectCostsSection } from "@/modules/costs/indirect-costs/indirect-costs-section";
import { MarginsSection } from "@/modules/costs/margins/margins-section";
import { ProfitabilitySection } from "@/modules/costs/profitability/profitability-section";

type CostingDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CostingDetailPage({
  params,
}: CostingDetailPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;

  const costing = await getCostingDetail(id);

  if (!costing) {
    notFound();
  }

  const workOrder = costing.orden_trabajo;

  const latestMargin = costing.margen_ganancia[0];
  const latestProfitability = costing.rentabilidad[0];

  const sourceLabel = workOrder
    ? `${workOrder.id_orden_trabajo} · ${workOrder.producto.nombre_producto}`
    : costing.pedido
      ? `${costing.pedido.id_pedido} · ${costing.pedido.cliente.nombre_razon_social}`
      : "Costeo manual";

  const clientName =
    workOrder?.detalle_pedido?.pedido.cliente.nombre_razon_social ??
    workOrder?.cliente?.nombre_razon_social ??
    costing.pedido?.cliente.nombre_razon_social ??
    null;

  return (
    <main className="space-y-6">
      <PageHeader
        title={`Costeo ${costing.id_costeo}`}
        description={sourceLabel}
        backHref={navigationHrefs.costs}
        backLabel="Volver a costos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Costos", href: navigationHrefs.costs },
          { label: "Costeos", href: navigationHrefs.costings },
          { label: "Detalle" },
        ])}
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/costs/work-orders">
              Generar otro costeo
            </Link>
          </Button>
        }
      />

      <CostingKpis costing={costing} />

      <section className="grid gap-4 md:grid-cols-2">
        <CostingDataCard costing={costing} clientName={clientName} />

        <EconomicStatusCard
          latestMargin={latestMargin}
          latestProfitability={latestProfitability}
        />
      </section>

      {latestProfitability?.alerta_bajo_margen ? (
        <Alert variant="destructive">
          <AlertDescription>
            <span className="font-medium text-foreground">
              Alerta de bajo margen
            </span>
            <span className="mt-1 block">
              La última rentabilidad calculada está por debajo del margen
              esperado. Revisa costos, precio final o margen aplicado antes de
              cerrar la evaluación comercial.
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <RecipeCostBreakdown workOrder={workOrder} />

      <IndirectCostsSection costing={costing} />

      <MarginsSection costing={costing} />

      <ProfitabilitySection costing={costing} latestMargin={latestMargin} />
    </main>
  );
}
