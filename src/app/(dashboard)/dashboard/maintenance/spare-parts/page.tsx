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
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { toggleSparePartStatusAction } from "@/modules/maintenance/spare-parts/actions";

type SparePartsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
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

function getStatusFilter(status: string) {
  if (status === "active") {
    return true;
  }

  if (status === "inactive") {
    return false;
  }

  return undefined;
}

export default async function SparePartsPage({
  searchParams,
}: SparePartsPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const provider = getSearchParam(params, "provider");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.repuestoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_repuesto: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_repuesto: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (provider) {
    filters.push({
      id_proveedor: provider,
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.repuestoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [spareParts, providers] = await Promise.all([
    prisma.repuesto.findMany({
      where,
      orderBy: [
        {
          estado: "desc",
        },
        {
          nombre_repuesto: "asc",
        },
      ],
      include: {
        proveedor: true,
        _count: {
          select: {
            detalle_repuesto_reparacion: true,
          },
        },
      },
    }),
    prisma.proveedor.findMany({
      orderBy: {
        razon_social: "asc",
      },
      select: {
        id_proveedor: true,
        razon_social: true,
      },
    }),
  ]);

  const activeSpareParts = spareParts.filter((sparePart) => sparePart.estado);
  const inactiveSpareParts = spareParts.filter((sparePart) => !sparePart.estado);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Listado de repuestos"
        description="Consulta repuestos disponibles para mantenimiento, proveedor, costo unitario, estado y uso historico en reparaciones."
        backHref={navigationHrefs.maintenance}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mantenimiento", href: navigationHrefs.maintenance },
          { label: "Repuestos" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/maintenance/spare-parts/new">
              Registrar repuesto
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Repuestos registrados" value={spareParts.length.toString()} description="Total en catálogo." tone="info" />
        <KpiCard title="Activos" value={activeSpareParts.length.toString()} description="Disponibles para uso." tone="success" />
        <KpiCard title="Inactivos" value={inactiveSpareParts.length.toString()} description="Fuera de catálogo." tone="warning" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action="/dashboard/maintenance/spare-parts"
            className="grid gap-3 md:grid-cols-4"
          >
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Buscar repuesto..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider">Proveedor</Label>
              <NativeSelect id="provider" name="provider" defaultValue={provider}>
                <option value="">Todos los proveedores</option>
                {providers.map((item) => (
                  <option key={item.id_proveedor} value={item.id_proveedor}>
                    {item.razon_social}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <NativeSelect id="status" name="status" defaultValue={status}>
                <option value="">Todos los estados</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </NativeSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">
                Filtrar
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/maintenance/spare-parts">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repuestos registrados</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {spareParts.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Aun no hay repuestos registrados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Repuesto</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Costo unitario</TableHead>
                  <TableHead className="text-right">Usos</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spareParts.map((sparePart) => (
                  <TableRow key={sparePart.id_repuesto} className="align-top">
                    <TableCell className="font-mono text-xs">
                      {sparePart.id_repuesto}
                    </TableCell>
                    <TableCell className="font-medium">
                      {sparePart.nombre_repuesto}
                      <p className="text-xs font-normal text-muted-foreground">
                        {sparePart.descripcion ?? "Sin descripcion"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {sparePart.proveedor?.razon_social ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(sparePart.costo_unitario)}
                    </TableCell>
                    <TableCell className="text-right">
                      {sparePart._count.detalle_repuesto_reparacion}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={sparePart.estado ? "success" : "secondary"}>
                        {sparePart.estado ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/dashboard/maintenance/spare-parts/${sparePart.id_repuesto}/edit`}
                          >
                            Editar
                          </Link>
                        </Button>
                        <form action={toggleSparePartStatusAction}>
                          <input
                            type="hidden"
                            name="id_repuesto"
                            value={sparePart.id_repuesto}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {sparePart.estado ? "Inactivar" : "Activar"}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
