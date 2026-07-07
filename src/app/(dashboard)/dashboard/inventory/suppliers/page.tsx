import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
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
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { toggleSupplierStatusAction } from "@/modules/inventory/suppliers/actions";

type SuppliersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function SuppliersPage({
  searchParams,
}: SuppliersPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const type = getSearchParam(params, "type");
  const payment = getSearchParam(params, "payment");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.proveedorWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_proveedor: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          razon_social: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          numero_documento: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          telefono: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (type) {
    filters.push({
      tipo_proveedor: type,
    });
  }

  if (payment) {
    filters.push({
      condicion_pago: payment,
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.proveedorWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [suppliers, supplierTypes, paymentConditions] = await Promise.all([
    prisma.proveedor.findMany({
      where,
      orderBy: {
        razon_social: "asc",
      },
    }),
    prisma.tipo_proveedor_catalogo.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        nombre: true,
        slug: true,
      },
    }),
    prisma.proveedor.findMany({
      where: {
        condicion_pago: {
          not: null,
        },
      },
      distinct: ["condicion_pago"],
      orderBy: {
        condicion_pago: "asc",
      },
      select: {
        condicion_pago: true,
      },
    }),
  ]);

  const typeLabels = new Map(
    supplierTypes.map((item) => [item.slug, item.nombre]),
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Proveedores"
        description="Registra proveedores de materia prima, consumibles, repuestos y servicios."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Proveedores" },
        ])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory/supplier-types">
                Tipos de proveedor
              </Link>
            </Button>

            <Button asChild>
              <Link href="/dashboard/inventory/suppliers/new">
                Nuevo proveedor
              </Link>
            </Button>
          </>
        }
      />

      <form
        action="/dashboard/inventory/suppliers"
        className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar proveedor..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <NativeSelect id="type" name="type" defaultValue={type}>
            <option value="">Todos los tipos</option>
            {supplierTypes.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment">Condición de pago</Label>
          <NativeSelect id="payment" name="payment" defaultValue={payment}>
            <option value="">Todas las condiciones</option>
            {paymentConditions.map((item) =>
              item.condicion_pago ? (
                <option key={item.condicion_pago} value={item.condicion_pago}>
                  {item.condicion_pago}
                </option>
              ) : null,
            )}
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

        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Filtrar
          </Button>
        </div>

        <div className="flex items-end">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard/inventory/suppliers">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Razón social</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Condición de pago</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id_proveedor}>
              <TableCell className="text-xs">
                {supplier.id_proveedor}
              </TableCell>
              <TableCell className="font-medium">
                {supplier.razon_social}
              </TableCell>
              <TableCell>
                {supplier.numero_documento
                  ? `${supplier.tipo_documento ?? "-"} ${supplier.numero_documento}`
                  : "-"}
              </TableCell>
              <TableCell>
                {typeLabels.get(supplier.tipo_proveedor) ??
                  supplier.tipo_proveedor}
              </TableCell>
              <TableCell>{supplier.telefono ?? "-"}</TableCell>
              <TableCell>{supplier.condicion_pago ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={supplier.estado ? "success" : "outline"}>
                  {supplier.estado ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/dashboard/inventory/suppliers/${supplier.id_proveedor}/edit`}
                    >
                      Editar
                    </Link>
                  </Button>

                  <form action={toggleSupplierStatusAction}>
                    <input
                      type="hidden"
                      name="id_proveedor"
                      value={supplier.id_proveedor}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      {supplier.estado ? "Inactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}

          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay proveedores registrados."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
