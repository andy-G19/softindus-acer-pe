import Link from "next/link";

import { PageHeader } from "@/components/navigation/page-header";
import {
  RowEditLink,
  RowToggleStatusButton,
} from "@/components/table/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { toggleSupplierMaterialStatusAction } from "@/modules/inventory/supplier-materials/actions";

type SupplierMaterialsPageProps = {
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

function getAvailabilityLabel(value: string | null) {
  const labels: Record<string, string> = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
    no_disponible: "No disponible",
  };

  return value ? labels[value] ?? value : "-";
}

export default async function SupplierMaterialsPage({
  searchParams,
}: SupplierMaterialsPageProps) {
  await requireRole(["ADMIN"]);

  const params = (await searchParams) ?? {};
  const supplier = getSearchParam(params, "supplier");
  const material = getSearchParam(params, "material");
  const availability = getSearchParam(params, "availability");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.proveedor_materialWhereInput[] = [];

  if (supplier) {
    filters.push({
      id_proveedor: supplier,
    });
  }

  if (material) {
    filters.push({
      id_material: material,
    });
  }

  if (availability) {
    filters.push({
      disponibilidad: availability,
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.proveedor_materialWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [relations, suppliers, materials] = await Promise.all([
    prisma.proveedor_material.findMany({
      where,
      orderBy: {
        fecha_actualizacion: "desc",
      },
      include: {
        proveedor: {
          select: {
            razon_social: true,
          },
        },
        material: {
          select: {
            nombre_material: true,
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
    prisma.material.findMany({
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Materiales por proveedor"
        description="Consulta qué proveedores abastecen cada material o insumo."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Proveedor-material" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/inventory/supplier-materials/new">
              Nueva asociación
            </Link>
          </Button>
        }
      />

      <form
        action="/dashboard/inventory/supplier-materials"
        className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-5"
      >
        <div className="space-y-2">
          <Label htmlFor="supplier">Proveedor</Label>
          <NativeSelect id="supplier" name="supplier" defaultValue={supplier}>
            <option value="">Todos los proveedores</option>
            {suppliers.map((item) => (
              <option key={item.id_proveedor} value={item.id_proveedor}>
                {item.razon_social}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="material">Material</Label>
          <NativeSelect id="material" name="material" defaultValue={material}>
            <option value="">Todos los materiales</option>
            {materials.map((item) => (
              <option key={item.id_material} value={item.id_material}>
                {item.nombre_material}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="availability">Disponibilidad</Label>
          <NativeSelect
            id="availability"
            name="availability"
            defaultValue={availability}
          >
            <option value="">Disponibilidad</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
            <option value="no_disponible">No disponible</option>
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
            <Link href="/dashboard/inventory/supplier-materials">
              Limpiar
            </Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Precio referencial</TableHead>
            <TableHead>Entrega</TableHead>
            <TableHead>Disponibilidad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {relations.map((relation) => (
            <TableRow key={relation.id_proveedor_material}>
              <TableCell className="text-xs">
                {relation.id_proveedor_material}
              </TableCell>
              <TableCell className="font-medium">
                {relation.proveedor.razon_social}
              </TableCell>
              <TableCell>{relation.material.nombre_material}</TableCell>
              <TableCell>{relation.unidad_medida}</TableCell>
              <TableCell>
                {formatMoney(relation.precio_referencial)}
              </TableCell>
              <TableCell>
                {relation.tiempo_entrega_dias
                  ? `${relation.tiempo_entrega_dias} días`
                  : "-"}
              </TableCell>
              <TableCell>
                {getAvailabilityLabel(relation.disponibilidad)}
              </TableCell>
              <TableCell>
                <Badge variant={relation.estado ? "success" : "outline"}>
                  {relation.estado ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <RowEditLink
                    href={`/dashboard/inventory/supplier-materials/${relation.id_proveedor_material}/edit`}
                  />
                  <RowToggleStatusButton
                    action={toggleSupplierMaterialStatusAction}
                    hiddenFieldName="id_proveedor_material"
                    hiddenFieldValue={relation.id_proveedor_material}
                    isActive={relation.estado}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}

          {relations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay asociaciones proveedor-material."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
