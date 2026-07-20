import { CheckCircle2, Tags, XCircle } from "lucide-react";
import Link from "next/link";

import {
  RowEditLink,
  RowToggleStatusButton,
} from "@/components/table/row-actions";
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
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import {
  createExpenseCategoryAction,
  toggleExpenseCategoryStatusAction,
} from "@/modules/petty-cash/categories/actions";
import { ExpenseCategoryForm } from "@/modules/petty-cash/categories/expense-category-form";

type ExpenseCategoriesPageProps = {
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

export default async function ExpenseCategoriesPage({
  searchParams,
}: ExpenseCategoriesPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.categoria_gastoWhereInput[] = [];

  if (q) {
    filters.push({
      nombre_categoria: {
        contains: q,
        mode: "insensitive",
      },
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.categoria_gastoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const categories = await prisma.categoria_gasto.findMany({
    where,
    orderBy: [
      {
        estado: "desc",
      },
      {
        nombre_categoria: "asc",
      },
    ],
  });

  const activeCategories = categories.filter((category) => category.estado);
  const inactiveCategories = categories.filter((category) => !category.estado);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Categorías de gasto"
        description="Registra y consulta categorías utilizadas para clasificar egresos de caja chica del taller."
        backHref={navigationHrefs.pettyCash}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Categorías" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Categorías registradas" value={categories.length.toString()} description="Total histórico." tone="info" icon={Tags} />
        <KpiCard title="Activas" value={activeCategories.length.toString()} description="Disponibles para clasificar egresos." tone="success" icon={CheckCircle2} />
        <KpiCard title="Inactivas" value={inactiveCategories.length.toString()} description="Ya no disponibles." tone="warning" icon={XCircle} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Nueva categoría de gasto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseCategoryForm
              action={createExpenseCategoryAction}
              defaultValues={{ estado: "true" }}
              submitLabel="Guardar categoría"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Listado de categorías</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action="/dashboard/petty-cash/categories"
              className="grid gap-3 md:grid-cols-3"
            >
              <div className="space-y-2">
                <Label htmlFor="q">Buscar</Label>
                <Input id="q" name="q" defaultValue={q} placeholder="Buscar categoría..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <NativeSelect id="status" name="status" defaultValue={status}>
                  <option value="">Todos los estados</option>
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </NativeSelect>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" className="flex-1">
                  Filtrar
                </Button>
                <Button variant="clear" asChild>
                  <Link href="/dashboard/petty-cash/categories">Limpiar</Link>
                </Button>
              </div>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id_categoria_gasto}>
                    <TableCell className="text-xs">
                      {category.id_categoria_gasto}
                    </TableCell>
                    <TableCell className="font-medium">
                      {category.nombre_categoria}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.descripcion ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={category.estado ? "success" : "secondary"}>
                        {category.estado ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <RowEditLink
                          href={`/dashboard/petty-cash/categories/${category.id_categoria_gasto}/edit`}
                        />
                        <RowToggleStatusButton
                          action={toggleExpenseCategoryStatusAction}
                          hiddenFieldName="id_categoria_gasto"
                          hiddenFieldValue={category.id_categoria_gasto}
                          isActive={category.estado}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        className="border-0"
                        label="Aún no hay categorías registradas."
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
