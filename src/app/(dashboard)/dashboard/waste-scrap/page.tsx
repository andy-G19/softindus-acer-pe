import { Boxes, CircleDollarSign, Recycle, Scissors } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";

function getStatusBadgeVariant(status: string) {
  if (["disponible", "acumulada"].includes(status)) {
    return "success" as const;
  }

  if (["reutilizado", "vendida"].includes(status)) {
    return "info" as const;
  }

  if (status === "descartado") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatMoney(value: unknown) {
  return `S/ ${formatNumber(value)}`;
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export default async function WasteScrapDashboardPage() {
  const session = await requireRole([
    APP_ROLES.ADMIN,
    APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canRegisterSale = session.user.role === APP_ROLES.ADMIN;

  const [
    totalRetazos,
    retazosDisponibles,
    retazosReutilizados,
    retazosDescartados,
    totalChatarra,
    chatarraAcumulada,
    chatarraVendida,
    ventasChatarra,
    ingresosChatarra,
    latestRetazos,
    pendingScraps,
    latestSales,
  ] = await Promise.all([
    prisma.retazo_reutilizable.count(),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "disponible",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "reutilizado",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "descartado",
      },
    }),

    prisma.chatarra.count(),

    prisma.chatarra.count({
      where: {
        estado: {
          in: ["acumulada", "disponible"],
        },
      },
    }),

    prisma.chatarra.count({
      where: {
        estado: "vendida",
      },
    }),

    prisma.venta_chatarra.count(),

    prisma.venta_chatarra.aggregate({
      _sum: {
        monto_recibido: true,
        peso_vendido_kg: true,
        cantidad_vendida: true,
      },
    }),

    prisma.retazo_reutilizable.findMany({
      orderBy: {
        fecha_registro: "desc",
      },
      take: 5,
      include: {
        material: true,
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
      },
    }),

    prisma.chatarra.findMany({
      where: {
        estado: {
          in: ["acumulada", "disponible"],
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
      take: 5,
      include: {
        material: true,
      },
    }),

    prisma.venta_chatarra.findMany({
      orderBy: {
        fecha_venta: "desc",
      },
      take: 5,
      include: {
        chatarra: {
          include: {
            material: true,
          },
        },
        movimiento_caja: true,
      },
    }),
  ]);

  const totalIngresos = toNumber(ingresosChatarra._sum.monto_recibido);
  const totalPesoVendido = toNumber(ingresosChatarra._sum.peso_vendido_kg);
  const totalCantidadVendida = toNumber(
    ingresosChatarra._sum.cantidad_vendida,
  );

  const moduleReady =
    totalRetazos > 0 || totalChatarra > 0 || ventasChatarra > 0;

  const hasAvailableReusableScraps = retazosDisponibles > 0;
  const hasPendingScrapSales = chatarraAcumulada > 0;
  const hasScrapIncome = totalIngresos > 0;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Mermas y chatarra"
        description="Controla los sobrantes generados en producción, diferenciando retazos reutilizables, chatarra acumulada y ventas de chatarra como ingreso menor del taller."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Mermas y chatarra" }])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`${navigationHrefs.reusableScraps}/new`}>
                Registrar retazo
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href={`${navigationHrefs.scraps}/new`}>
                Registrar chatarra
              </Link>
            </Button>

            {canRegisterSale ? (
              <Button variant="outline" asChild>
                <Link href={`${navigationHrefs.scrapSales}/new`}>
                  Registrar venta
                </Link>
              </Button>
            ) : null}

            <Button variant="outline" asChild>
              <Link href={navigationHrefs.reusableScraps}>Ver retazos</Link>
            </Button>

            <Button asChild>
              <Link href={navigationHrefs.scraps}>Ver chatarra</Link>
            </Button>
          </>
        }
      />

      <Alert variant={moduleReady ? "success" : "warning"}>
        <AlertTitle>
          {moduleReady
            ? "Módulo operativo y con registros"
            : "Módulo listo para iniciar registros"}
        </AlertTitle>
        <AlertDescription>
          {moduleReady
            ? "El módulo ya permite registrar, consultar y controlar retazos, chatarra y ventas de chatarra."
            : "Aún no hay registros. Empieza registrando retazos reutilizables o chatarra generada."}
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Retazos registrados" value={totalRetazos.toString()} description={`${retazosDisponibles} disponibles`} tone="info" icon={Scissors} />
        <KpiCard title="Retazos reutilizados" value={retazosReutilizados.toString()} description={`${retazosDescartados} descartados`} tone="success" icon={Recycle} />
        <KpiCard title="Chatarra pendiente" value={chatarraAcumulada.toString()} description={`${chatarraVendida} registros vendidos`} tone="info" icon={Boxes} />
        <KpiCard title="Ingresos por chatarra" value={formatMoney(totalIngresos)} description={`${ventasChatarra} venta(s) registradas`} tone="success" icon={CircleDollarSign} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">
              Retazos disponibles
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {hasAvailableReusableScraps ? "Sí" : "No"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasAvailableReusableScraps
                ? "Existen retazos que pueden ser reutilizados en producción."
                : "No hay retazos disponibles para reutilizar."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">
              Chatarra pendiente de venta
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {hasPendingScrapSales ? "Sí" : "No"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasPendingScrapSales
                ? "Hay chatarra acumulada que puede generar ingreso menor."
                : "No hay chatarra acumulada pendiente de venta."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">
              Ingreso recuperado
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {hasScrapIncome ? "Registrado" : "Sin ingresos"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Peso vendido: {formatNumber(totalPesoVendido)} kg | Cantidad:{" "}
              {formatNumber(totalCantidadVendida)}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden py-0">
          <div className="flex flex-col justify-between gap-3 border-b border-border/70 p-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Últimos retazos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Retazos reutilizables registrados recientemente.
              </p>
            </div>

            <Link
              href="/dashboard/waste-scrap/reusable-scraps"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {latestRetazos.length === 0 ? (
            <EmptyState className="border-0" label="Aún no hay retazos registrados." />
          ) : (
            <div className="divide-y divide-border/70">
              {latestRetazos.map((item) => (
                <div
                  key={item.id_retazo}
                  className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.id_retazo} | {formatDate(item.fecha_registro)}
                    </p>

                    <p className="font-medium text-foreground">
                      {item.material.nombre_material}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatNumber(item.cantidad)} {item.unidad_medida} |{" "}
                      {item.medida_aproximada ?? "Sin medida"} |{" "}
                      {item.ubicacion ?? "Sin ubicación"}
                    </p>

                    {item.orden_trabajo ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Orden: {item.orden_trabajo.id_orden_trabajo} |{" "}
                        {item.orden_trabajo.producto.nombre_producto}
                      </p>
                    ) : null}
                  </div>

                  <Badge variant={getStatusBadgeVariant(item.estado)} className="w-fit">
                    {item.estado}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden py-0">
          <div className="flex flex-col justify-between gap-3 border-b border-border/70 p-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Chatarra pendiente</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Chatarra acumulada o disponible para venta.
              </p>
            </div>

            <Link
              href="/dashboard/waste-scrap/scraps"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {pendingScraps.length === 0 ? (
            <EmptyState className="border-0" label="No hay chatarra pendiente de venta." />
          ) : (
            <div className="divide-y divide-border/70">
              {pendingScraps.map((item) => (
                <div key={item.id_chatarra} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.id_chatarra}
                    </p>

                    <Badge variant={getStatusBadgeVariant(item.estado)}>
                      {item.estado}
                    </Badge>
                  </div>

                  <p className="mt-2 font-medium text-foreground">{item.tipo_material}</p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Peso:{" "}
                    {item.peso_kg ? `${formatNumber(item.peso_kg)} kg` : "-"} |
                    Cantidad: {item.cantidad ? formatNumber(item.cantidad) : "-"}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Material origen:{" "}
                    {item.material?.nombre_material ?? "No identificado"}
                  </p>

                  {canRegisterSale ? (
                    <Link
                      href={`/dashboard/waste-scrap/scrap-sales/new?id_chatarra=${item.id_chatarra}`}
                      className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      Registrar venta
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <Card className="overflow-hidden py-0">
        <div className="border-b border-border/70 p-5">
          <h2 className="text-lg font-semibold text-foreground">Últimas ventas de chatarra</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresos menores obtenidos por venta de chatarra.
          </p>
        </div>

        {latestSales.length === 0 ? (
          <EmptyState className="border-0" label="Aún no hay ventas de chatarra registradas." />
        ) : (
          <div className="divide-y divide-border/70">
            {latestSales.map((item) => (
              <div
                key={item.id_venta_chatarra}
                className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center"
              >
                <div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.id_venta_chatarra} | {formatDate(item.fecha_venta)}
                  </p>

                  <p className="font-medium text-foreground">
                    {item.chatarra.tipo_material}
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Peso vendido:{" "}
                    {item.peso_vendido_kg
                      ? `${formatNumber(item.peso_vendido_kg)} kg`
                      : "-"}{" "}
                    | Cantidad:{" "}
                    {item.cantidad_vendida
                      ? formatNumber(item.cantidad_vendida)
                      : "-"}{" "}
                    | Monto: {formatMoney(item.monto_recibido)}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Destino: {item.destino_dinero ?? "No especificado"}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Caja chica:{" "}
                    {item.id_movimiento_caja
                      ? `vinculada al movimiento ${item.id_movimiento_caja}`
                      : "no vinculada"}
                  </p>
                </div>

                <Badge variant="info" className="w-fit">
                  Venta registrada
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Validaciones finales del módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
              <p className="font-medium text-foreground">
                Registro de retazos reutilizables
              </p>
              <p className="mt-1 text-muted-foreground">
                Se pueden registrar retazos con material, cantidad, unidad,
                ubicación y orden relacionada opcional.
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
              <p className="font-medium text-foreground">
                Registro de chatarra generada
              </p>
              <p className="mt-1 text-muted-foreground">
                Se puede registrar chatarra por tipo, peso, cantidad y material de
                origen opcional.
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
              <p className="font-medium text-foreground">
                Venta de chatarra
              </p>
              <p className="mt-1 text-muted-foreground">
                La venta cambia la chatarra a vendida y puede generar ingreso en
                caja chica.
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
              <p className="font-medium text-foreground">
                Cambio de estado de retazos
              </p>
              <p className="mt-1 text-muted-foreground">
                Los retazos disponibles pueden marcarse como reutilizados o
                descartados.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

