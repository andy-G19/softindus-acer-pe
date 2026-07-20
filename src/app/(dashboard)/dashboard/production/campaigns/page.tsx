import { Calculator, CalendarClock, Layers } from "lucide-react";
import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { changeProductionCampaignStatusAction } from "@/modules/production/campaigns/actions";

type ProductionCampaignsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
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

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function parseDate(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function ProductionCampaignsPage({
  searchParams,
}: ProductionCampaignsPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const product = getSearchParam(params, "product");
  const status = getSearchParam(params, "status");
  const from = getSearchParam(params, "from");
  const to = getSearchParam(params, "to");
  const fromDate = parseDate(from);
  const toDate = parseDate(to, true);
  const filters: Prisma.campania_produccionWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_campania: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_campania: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (product) {
    filters.push({
      campania_detalle: {
        some: {
          id_producto: product,
        },
      },
    });
  }

  if (status) {
    filters.push({
      estado: status,
    });
  }

  if (fromDate || toDate) {
    filters.push({
      fecha_inicio: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }

  const where: Prisma.campania_produccionWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [campaigns, products] = await Promise.all([
    prisma.campania_produccion.findMany({
      where,
      include: {
        campania_detalle: {
          select: {
            cantidad_objetivo: true,
            cantidad_producida: true,
          },
        },
        _count: {
          select: {
            campania_detalle: true,
            orden_trabajo: true,
          },
        },
      },
      orderBy: [
        {
          fecha_inicio: "desc",
        },
        {
          id_campania: "desc",
        },
      ],
    }),
    prisma.producto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_producto: "asc",
      },
      select: {
        id_producto: true,
        nombre_producto: true,
      },
    }),
  ]);

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
    <main className="space-y-6">
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
            <Link href="/dashboard/production/campaigns/new">
              Nueva campaña
            </Link>
          </Button>
        }
      />

      <form className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar campaña..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product">Producto</Label>
          <NativeSelect id="product" name="product" defaultValue={product}>
            <option value="">Todos los productos</option>
            {products.map((item) => (
              <option key={item.id_producto} value={item.id_producto}>
                {item.nombre_producto}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <NativeSelect id="status" name="status" defaultValue={status}>
            <option value="">Todos los estados</option>
            <option value="planificada">Planificada</option>
            <option value="activa">Activa</option>
            <option value="finalizada">Finalizada</option>
            <option value="anulada">Anulada</option>
          </NativeSelect>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" name="from" type="date" defaultValue={from} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </div>
        </div>

        <div className="flex items-end gap-2 md:col-span-4">
          <Button type="submit">Filtrar</Button>
          <Button variant="clear" asChild>
            <Link href="/dashboard/production/campaigns">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

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
                  <div>Inicio: {formatDate(campaign.fecha_inicio)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fin: {formatDate(campaign.fecha_fin)}
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
                          href={`/dashboard/production/campaigns/${campaign.id_campania}/edit`}
                        >
                          Editar
                        </Link>
                      </Button>
                    ) : null}

                    {campaign.estado === "planificada" ? (
                      <form action={changeProductionCampaignStatusAction}>
                        <input
                          type="hidden"
                          name="id_campania"
                          value={campaign.id_campania}
                        />
                        <input type="hidden" name="estado" value="activa" />
                        <Button type="submit" variant="link" className="h-auto justify-start p-0">
                          Activar
                        </Button>
                      </form>
                    ) : null}

                    {campaign.estado === "activa" ? (
                      <form action={changeProductionCampaignStatusAction}>
                        <input
                          type="hidden"
                          name="id_campania"
                          value={campaign.id_campania}
                        />
                        <input type="hidden" name="estado" value="finalizada" />
                        <Button type="submit" variant="link" className="h-auto justify-start p-0">
                          Finalizar
                        </Button>
                      </form>
                    ) : null}

                    {!["anulada", "finalizada"].includes(campaign.estado) ? (
                      <form action={changeProductionCampaignStatusAction}>
                        <input
                          type="hidden"
                          name="id_campania"
                          value={campaign.id_campania}
                        />
                        <input type="hidden" name="estado" value="anulada" />
                        <ConfirmDeleteButton
                          title="¿Anular campaña?"
                          description="Esta acción anulará la campaña de producción y no se puede deshacer."
                          confirmText="Confirmar anulación"
                          entityName="campaña"
                          className="rounded-none border-0 bg-transparent px-0 py-0 hover:bg-transparent"
                        >
                          Anular
                        </ConfirmDeleteButton>
                      </form>
                    ) : null}
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
    </main>
  );
}
