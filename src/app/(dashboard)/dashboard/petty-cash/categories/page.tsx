import { CheckCircle2, Tags, XCircle } from "lucide-react";

import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
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
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import {
  createExpenseCategoryAction,
  toggleExpenseCategoryStatusAction,
  updateExpenseCategoryAction,
} from "@/modules/petty-cash/categories/actions";
import { ExpenseCategoryDialog } from "@/modules/petty-cash/categories/expense-category-form";
import { ExpenseCategoryStatusButton } from "@/modules/petty-cash/categories/expense-category-status-button";
import { getExpenseCategoryList } from "@/modules/petty-cash/categories/queries";
import { pettyCashNotifications } from "@/modules/petty-cash/notifications";

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

export default async function ExpenseCategoriesPage({
  searchParams,
}: ExpenseCategoriesPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const status = getSearchParam(params, "status");
  const categories = await getExpenseCategoryList({ q, status });

  const activeCategories = categories.filter((category) => category.estado);
  const inactiveCategories = categories.filter((category) => !category.estado);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías de gasto"
        description="Registra y consulta categorías utilizadas para clasificar egresos de caja chica del taller."
        backHref={navigationHrefs.pettyCash}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Categorías" },
        ])}
        actions={
          <>
            <Badge>Solo ADMIN</Badge>
            <ExpenseCategoryDialog
              action={createExpenseCategoryAction}
              title="Nueva categoría de gasto"
              submitLabel="Guardar categoría"
              successNotification={pettyCashNotifications["expense-category-created"]}
              trigger={<Button type="button">Nueva categoría</Button>}
            />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Categorías registradas" value={categories.length.toString()} description="Total histórico." tone="info" icon={Tags} />
        <KpiCard title="Activas" value={activeCategories.length.toString()} description="Disponibles para clasificar egresos." tone="success" icon={CheckCircle2} />
        <KpiCard title="Inactivas" value={inactiveCategories.length.toString()} description="Ya no disponibles." tone="warning" icon={XCircle} />
      </section>

      <FilterBar
        action="/dashboard/petty-cash/categories"
        label="Filtros de categorías de gasto"
        clearHref="/dashboard/petty-cash/categories"
        clearLabel="Limpiar"
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar categoría..." />}
        </Field>
        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
            </NativeSelect>
          )}
        </Field>
      </FilterBar>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listado de categorías</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                        <ExpenseCategoryDialog
                          action={updateExpenseCategoryAction}
                          category={{
                            id_categoria_gasto: category.id_categoria_gasto,
                            nombre_categoria: category.nombre_categoria,
                            descripcion: category.descripcion,
                          }}
                          title="Editar categoría de gasto"
                          submitLabel="Guardar cambios"
                          successNotification={pettyCashNotifications["expense-category-updated"]}
                          trigger={
                            <Button type="button" variant="ghost" size="sm">
                              Editar
                            </Button>
                          }
                        />
                        <ExpenseCategoryStatusButton
                          category={category}
                          action={toggleExpenseCategoryStatusAction}
                          activatedNotification={pettyCashNotifications["expense-category-activated"]}
                          deactivatedNotification={pettyCashNotifications["expense-category-deactivated"]}
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
    </div>
  );
}
