import Link from "next/link";

import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import {
  RowActions,
  RowEditLink,
  RowToggleStatusButton,
} from "@/components/table/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { getPaginationMeta, getPaginationParams } from "@/lib/pagination";
import { toggleMaterialStatusAction } from "@/modules/inventory/materials/actions";

type MaterialsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
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

export default async function MaterialsPage({
  searchParams,
}: MaterialsPageProps) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const category = getSearchParam(params, "category");
  const unit = getSearchParam(params, "unit");
  const status = getSearchParam(params, "status");
  const stock = getSearchParam(params, "stock");
  const returnTo = createReturnToHref(navigationHrefs.materials, params);
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.materialWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_material: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_material: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (category) {
    filters.push({
      categoria: category,
    });
  }

  if (unit) {
    filters.push({
      unidad_medida: unit,
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.materialWhereInput =
    filters.length > 0 ? { AND: filters } : {};
  const { page, pageSize, skip, take } = getPaginationParams(params);

  function isCriticalStock(material: {
    stock_actual: unknown;
    stock_reservado: unknown;
    stock_minimo: unknown;
  }) {
    const stockActual = Number(String(material.stock_actual));
    const stockReservado = Number(String(material.stock_reservado));
    const stockMinimo = Number(String(material.stock_minimo));
    const stockDisponible = stockActual - stockReservado;

    return stockMinimo > 0 && stockDisponible <= stockMinimo;
  }

  const [materialsQuery, categories, units] = await Promise.all([
    // El filtro "stock" compara stock_actual - stock_reservado contra
    // stock_minimo (tres columnas entre si): Prisma no puede expresar eso en
    // un `where`. Cuando ese filtro esta activo, se resuelve y se pagina en
    // memoria sobre el conjunto ya acotado por el resto de filtros (q,
    // categoria, unidad, estado); en el caso normal (sin filtro de stock) la
    // paginacion es 100% a nivel de base de datos con skip/take/count.
    stock === "critical" || stock === "ok"
      ? prisma.material
          .findMany({
            where,
            orderBy: [{ fecha_registro: "desc" }, { id_material: "desc" }],
          })
          .then((allMatching) => {
            const filtered = allMatching.filter((material) => {
              const isCritical = isCriticalStock(material);
              return stock === "critical" ? isCritical : !isCritical;
            });

            return {
              materials: filtered.slice(skip, skip + take),
              totalItems: filtered.length,
            };
          })
      : Promise.all([
          prisma.material.findMany({
            where,
            orderBy: [{ fecha_registro: "desc" }, { id_material: "desc" }],
            skip,
            take,
          }),
          prisma.material.count({ where }),
        ]).then(([materials, totalItems]) => ({ materials, totalItems })),
    prisma.categoria_material.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        nombre: true,
        slug: true,
      },
    }),
    prisma.material.findMany({
      distinct: ["unidad_medida"],
      orderBy: {
        unidad_medida: "asc",
      },
      select: {
        unidad_medida: true,
      },
    }),
  ]);

  const { materials, totalItems } = materialsQuery;
  const meta = getPaginationMeta({ totalItems, page, pageSize });
  const isAdmin = session.user.role === "ADMIN";
  const categoryLabels = new Map(
    categories.map((item) => [item.slug, item.nombre]),
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Materiales e insumos"
        description="Consulta stock actual, stock reservado, stock mínimo y costo vigente."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Materiales" },
        ])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory/material-categories">
                Categorías
              </Link>
            </Button>

            {isAdmin ? (
              <Button asChild>
                <Link href="/dashboard/inventory/materials/new">
                  Nuevo material
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <form
        action="/dashboard/inventory/materials"
        className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar material..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <NativeSelect id="category" name="category" defaultValue={category}>
            <option value="">Todas las categorías</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">Unidad</Label>
          <NativeSelect id="unit" name="unit" defaultValue={unit}>
            <option value="">Todas las unidades</option>
            {units.map((item) => (
              <option key={item.unidad_medida} value={item.unidad_medida}>
                {item.unidad_medida}
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

        <div className="space-y-2">
          <Label htmlFor="stock">Stock</Label>
          <NativeSelect id="stock" name="stock" defaultValue={stock}>
            <option value="">Todo el stock</option>
            <option value="critical">Críticos</option>
            <option value="ok">No críticos</option>
          </NativeSelect>
        </div>

        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Filtrar
          </Button>
        </div>

        <div className="flex items-end">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard/inventory/materials">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead>Reservado</TableHead>
            <TableHead>Disponible</TableHead>
            <TableHead>Stock mínimo</TableHead>
            <TableHead>Costo actual</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {materials.map((material) => {
              const stockActual = Number(material.stock_actual.toString());
              const stockReservado = Number(material.stock_reservado.toString());
              const stockMinimo = Number(material.stock_minimo.toString());
              const stockDisponible = stockActual - stockReservado;
              const isLowStock =
                stockMinimo > 0 && stockDisponible <= stockMinimo;

              return (
                <TableRow key={material.id_material}>
                  <TableCell className="text-xs">
                    {material.id_material}
                  </TableCell>
                  <TableCell className="font-medium">
                    {material.nombre_material}
                  </TableCell>
                  <TableCell>
                    {categoryLabels.get(material.categoria) ??
                      material.categoria}
                  </TableCell>
                  <TableCell>{material.unidad_medida}</TableCell>
                  <TableCell>
                    {formatDecimal(material.stock_actual)}
                  </TableCell>
                  <TableCell>
                    {formatDecimal(material.stock_reservado)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isLowStock ? "destructive" : "success"}>
                      {stockDisponible.toFixed(2)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDecimal(material.stock_minimo)}
                  </TableCell>
                  <TableCell>
                    {formatMoney(material.costo_unitario_actual)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={material.estado ? "success" : "outline"}>
                      {material.estado ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <RowActions>
                        <RowEditLink
                          href={withReturnTo(
                            `${navigationHrefs.materials}/${material.id_material}/edit`,
                            returnTo,
                          )}
                        />

                        <RowToggleStatusButton
                          action={toggleMaterialStatusAction}
                          hiddenFieldName="id_material"
                          hiddenFieldValue={material.id_material}
                          isActive={material.estado}
                        />
                      </RowActions>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Solo lectura
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {materials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="p-0">
                  <EmptyState
                    className="border-0"
                    label="Todavía no hay materiales registrados."
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
      </Table>

      <PaginationControls
        meta={meta}
        basePath={navigationHrefs.materials}
        searchParams={params}
        itemLabel="materiales"
      />
    </main>
  );
}
