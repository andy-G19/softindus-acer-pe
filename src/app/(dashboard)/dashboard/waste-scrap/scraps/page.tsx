import {
  CircleDollarSign,
  ClipboardList,
  Recycle,
  Scale,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";

type SearchParams = {
  estado?: string;
  material?: string;
  q?: string;
};

type ScrapsPageProps = {
  searchParams?: Promise<SearchParams>;
};

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

function getStatusBadgeVariant(status: string) {
  if (["acumulada", "disponible"].includes(status)) {
    return "success" as const;
  }

  if (status === "vendida") {
    return "info" as const;
  }

  return "secondary" as const;
}

export default async function ScrapsPage({ searchParams }: ScrapsPageProps) {
  const session = await requireRole([
      APP_ROLES.ADMIN,
      APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canRegisterSale = session.user.role === APP_ROLES.ADMIN;

  const params = searchParams ? await searchParams : {};

  const estado = params.estado?.trim() ?? "";
  const material = params.material?.trim() ?? "";
  const query = params.q?.trim() ?? "";

  const where = {
    ...(estado
      ? {
          estado,
        }
      : {}),

    ...(material
      ? {
          id_material: material,
        }
      : {}),

    ...(query
      ? {
          OR: [
            {
              id_chatarra: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              tipo_material: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              observaciones: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [
    materials,
    scraps,
    totalFiltered,
    totalScraps,
    chatarraAcumulada,
    chatarraVendida,
    filteredTotals,
  ] = await Promise.all([
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
      },
    }),

    prisma.chatarra.findMany({
      where,
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        material: true,
        venta_chatarra: {
          orderBy: {
            fecha_venta: "desc",
          },
          take: 1,
        },
      },
    }),

    prisma.chatarra.count({
      where,
    }),

    prisma.chatarra.count(),

    prisma.chatarra.count({
      where: {
        estado: "acumulada",
      },
    }),

    prisma.chatarra.count({
      where: {
        estado: "vendida",
      },
    }),

    prisma.chatarra.aggregate({
      where,
      _sum: {
        peso_kg: true,
        cantidad: true,
      },
    }),
  ]);

  const hasFilters = Boolean(estado || material || query);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Chatarra generada"
        description="Consulta los materiales no reutilizables acumulados durante la producción. Puedes filtrar por estado, material de origen o buscar por código, tipo de material u observación."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mermas y chatarra", href: navigationHrefs.wasteScrap },
          { label: "Chatarra" },
        ])}
        actions={
          <>
            <Button asChild>
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
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total registros" value={totalScraps.toString()} description={`${totalFiltered} según filtros`} tone="info" icon={ClipboardList} />
        <KpiCard title="Acumulada" value={chatarraAcumulada.toString()} description="Pendiente de venta" tone="warning" icon={Recycle} />
        <KpiCard title="Vendida" value={chatarraVendida.toString()} description="Ya generó ingreso menor" tone="success" icon={CircleDollarSign} />
        <KpiCard title="Peso filtrado" value={`${formatNumber(filteredTotals._sum.peso_kg)} kg`} description={`Cantidad: ${formatNumber(filteredTotals._sum.cantidad)}`} tone="info" icon={Scale} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <NativeSelect id="estado" name="estado" defaultValue={estado}>
                <option value="">Todos</option>
                <option value="acumulada">Acumulada</option>
                <option value="disponible">Disponible</option>
                <option value="vendida">Vendida</option>
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="material">Material</Label>
              <NativeSelect id="material" name="material" defaultValue={material}>
                <option value="">Todos</option>
                {materials.map((item) => (
                  <option key={item.id_material} value={item.id_material}>
                    {item.nombre_material} | {item.categoria}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Código, tipo u observación"
              />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit">Filtrar</Button>
              {hasFilters ? (
                <Button variant="clear" asChild>
                  <Link href="/dashboard/waste-scrap/scraps">Limpiar</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado de chatarra</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {scraps.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron registros de chatarra con los filtros seleccionados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Material origen</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Observación</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {scraps.map((item) => {
                  const latestSale = item.venta_chatarra[0];

                  return (
                    <TableRow key={item.id_chatarra} className="align-top">
                      <TableCell className="font-mono text-xs">
                        {item.id_chatarra}
                      </TableCell>

                      <TableCell className="font-medium">
                        {item.tipo_material}
                      </TableCell>

                      <TableCell>
                        {item.material ? (
                          <div>
                            <p className="font-medium">
                              {item.material.nombre_material}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.material.categoria}
                            </p>
                          </div>
                        ) : (
                          "No identificado"
                        )}
                      </TableCell>

                      <TableCell>
                        {item.peso_kg
                          ? `${formatNumber(item.peso_kg)} kg`
                          : "-"}
                      </TableCell>

                      <TableCell>
                        {item.cantidad ? formatNumber(item.cantidad) : "-"}
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={getStatusBadgeVariant(item.estado)}>
                            {item.estado}
                          </Badge>

                          {latestSale ? (
                            <p className="text-xs text-muted-foreground">
                              Vendida el {formatDate(latestSale.fecha_venta)}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>{formatDate(item.fecha_registro)}</TableCell>

                      <TableCell>{item.observaciones ?? "-"}</TableCell>

                      <TableCell>
                        {canRegisterSale && item.estado !== "vendida" ? (
                          <Link
                            href={`/dashboard/waste-scrap/scrap-sales/new?id_chatarra=${item.id_chatarra}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Vender
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
