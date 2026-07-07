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
import { toggleProductStatusAction } from "@/modules/commercial/products/actions";

type ProductsPageProps = {
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

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const category = getSearchParam(params, "category");
  const unit = getSearchParam(params, "unit");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.productoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_producto: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_producto: {
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

  const where: Prisma.productoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [products, categories, units] = await Promise.all([
    prisma.producto.findMany({
      where,
      orderBy: {
        fecha_registro: "desc",
      },
    }),
    prisma.categoria_producto.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        nombre: true,
        slug: true,
      },
    }),
    prisma.producto.findMany({
      distinct: ["unidad_medida"],
      orderBy: {
        unidad_medida: "asc",
      },
      select: {
        unidad_medida: true,
      },
    }),
  ]);

  const canManageProduct = session.user.role === "ADMIN";
  const categoryLabels = new Map(
    categories.map((item) => [item.slug, item.nombre]),
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Productos"
        description="Lista de productos registrados para ventas, pedidos y producción."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Productos" },
        ])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/commercial/product-categories">
                Categorías
              </Link>
            </Button>

            {canManageProduct ? (
              <Button asChild>
                <Link href="/dashboard/commercial/products/new">
                  Nuevo producto
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <form
        action="/dashboard/commercial/products"
        className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Buscar producto..."
          />
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

        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Filtrar
          </Button>
        </div>

        <div className="flex items-end">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard/commercial/products">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Precio referencial</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id_producto}>
              <TableCell>{product.id_producto}</TableCell>
              <TableCell className="font-medium">
                {product.nombre_producto}
              </TableCell>
              <TableCell>
                {categoryLabels.get(product.categoria) ?? product.categoria}
              </TableCell>
              <TableCell>{product.unidad_medida}</TableCell>
              <TableCell>
                {formatMoney(product.precio_referencial)}
              </TableCell>
              <TableCell>
                <Badge variant={product.estado ? "success" : "outline"}>
                  {product.estado ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                {canManageProduct ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/dashboard/commercial/products/${product.id_producto}/edit`}
                      >
                        Editar
                      </Link>
                    </Button>

                    <form action={toggleProductStatusAction}>
                      <input
                        type="hidden"
                        name="id_producto"
                        value={product.id_producto}
                      />
                      <Button type="submit" variant="outline" size="sm">
                        {product.estado ? "Inactivar" : "Activar"}
                      </Button>
                    </form>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Solo lectura
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}

          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay productos registrados."
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
