import { Calculator, CalendarClock, Layers } from "lucide-react";
import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/formatters";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { parseDateParam, parseStringParam } from "@/lib/search-params";
import { changeProductionCampaignStatusAction } from "@/modules/production/campaigns/actions";
import { CampaignStatusActions } from "@/modules/production/campaigns/campaign-status-actions";
import { getProductionCampaignListData } from "@/modules/production/campaigns/queries";
import { productionNotifications } from "@/modules/production/notifications";

type ProductionCampaignsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function getCampaignBadgeVariant(status: string) {
  if (status === "activa") {
    return "success" as const;
  }

  if (status === "planificada") {
    return "info" as const;
  }

  if (status === "anulada") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export default async function ProductionCampaignsPage({
  searchParams,
}: ProductionCampaignsPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const product = parseStringParam(params, "product");
  const status = parseStringParam(params, "status");
  const from = parseStringParam(params, "from");
  const to = parseStringParam(params, "to");
  const fromDate = parseDateParam(params, "from");
  const toDate = parseDateParam(params, "to");
  const returnTo = createReturnToHref(navigationHrefs.campaigns, params);
  const { campaigns, products } = await getProductionCampaignListData({
    q,
    product,
    status,
    fromDate,
    toDate,
  });

  const activeCampaigns = campaigns.filter((campaign) =>
    ["planificada", "activa"].includes(campaign.estado),
  );
  const totalTarget = campaigns.reduce((total, campaign) => {
    return (
      total +
      campaign.campania_detalle.reduce(
        (detailTotal, detail) =>
          detailTotal + toNumber(detail.cantidad_objetivo),
        0,
      )
    );
  }, 0);
  const totalProduced = campaigns.reduce((total, campaign) => {
    return (
      total +
      campaign.campania_detalle.reduce(
        (detailTotal, detail) =>
          detailTotal + toNumber(detail.cantidad_producida),
        0,
      )
    );
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campañas de producción"
        description="Planifica lotes de producción por campaña y consulta el avance por producto."
        backHref={navigationHrefs.production}
        backLabel="Volver a producción"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Campañas" },
        ])}
        actions={
          <Button asChild>
            <Link href={withReturnTo(`${navigationHrefs.campaigns}/new`, returnTo)}>
              Nueva campaña
            </Link>
          </Button>
        }
      />

      <FilterBar
        action={navigationHrefs.campaigns}
        label="Filtros de campañas"
        clearHref={navigationHrefs.campaigns}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar campaña..." />}
        </Field>

        <Field id="product" label="Producto">
          {(control) => (
            <NativeSelect {...control} name="product" defaultValue={product}>
              <option value="">Todos los productos</option>
              {products.map((item) => (
                <option key={item.id_producto} value={item.id_producto}>
                  {item.nombre_producto}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="planificada">Planificada</option>
              <option value="activa">Activa</option>
              <option value="finalizada">Finalizada</option>
              <option value="anulada">Anulada</option>
            </NativeSelect>
          )}
        </Field>

        <DateRangeFields id="fecha" defaultFrom={from} defaultTo={to} />
      </FilterBar>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Campañas registradas" value={campaigns.length.toString()} description="Total histórico." tone="info" icon={Layers} />
        <KpiCard title="Planificadas o activas" value={activeCampaigns.length.toString()} description="En ejecución o por iniciar." tone="warning" icon={CalendarClock} />
        <KpiCard title="Objetivo total" value={totalTarget.toFixed(2)} description="Suma de cantidades objetivo." tone="info" icon={Calculator} />
        <KpiCard title="Producido total" value={totalProduced.toFixed(2)} description="Suma de cantidades producidas." tone="success" icon={Calculator} />
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Campaña</TableHead>
            <TableHead>Fechas</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead>Objetivo</TableHead>
            <TableHead>Producido</TableHead>
            <TableHead>Órdenes</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {campaigns.map((campaign) => {
            const campaignTarget = campaign.campania_detalle.reduce(
              (total, detail) => total + toNumber(detail.cantidad_objetivo),
              0,
            );
            const campaignProduced = campaign.campania_detalle.reduce(
              (total, detail) => total + toNumber(detail.cantidad_producida),
              0,
            );

            return (
              <TableRow key={campaign.id_campania}>
                <TableCell className="text-xs">
                  {campaign.id_campania}
                </TableCell>

                <TableCell>
                  <div className="font-medium">
                    {campaign.nombre_campania}
                  </div>

                  {campaign.objetivo_general ? (
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                      {campaign.objetivo_general}
                    </p>
                  ) : null}
                </TableCell>

                <TableCell>
                  <div>Inicio: {formatDate(campaign.fecha_inicio, { format: "d mmm yyyy" })}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fin: {formatDate(campaign.fecha_fin, { format: "d mmm yyyy" })}
                  </p>
                </TableCell>

                <TableCell>{campaign._count.campania_detalle}</TableCell>

                <TableCell>{formatDecimal(campaignTarget)}</TableCell>

                <TableCell>{formatDecimal(campaignProduced)}</TableCell>

                <TableCell>{campaign._count.orden_trabajo}</TableCell>

                <TableCell>
                  <Badge variant={getCampaignBadgeVariant(campaign.estado)}>
                    {campaign.estado}
                  </Badge>
                </TableCell>

                <TableCell>
                  <div className="flex flex-col gap-2">
                    <Button variant="link" className="h-auto justify-start p-0" asChild>
                      <Link
                        href={`/dashboard/production/campaigns/${campaign.id_campania}`}
                      >
                        Ver detalle
                      </Link>
                    </Button>

                    {campaign.estado !== "anulada" ? (
                      <Button variant="link" className="h-auto justify-start p-0" asChild>
                        <Link
                          href={withReturnTo(`${navigationHrefs.campaigns}/${campaign.id_campania}/edit`, returnTo)}
                        >
                          Editar
                        </Link>
                      </Button>
                    ) : null}

                    <CampaignStatusActions
                      campaign={campaign}
                      action={changeProductionCampaignStatusAction}
                      activatedNotification={productionNotifications["campaign-status-activa"]}
                      finishedNotification={productionNotifications["campaign-status-finalizada"]}
                      annulledNotification={productionNotifications["campaign-status-anulada"]}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {campaigns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay campañas de producción registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
