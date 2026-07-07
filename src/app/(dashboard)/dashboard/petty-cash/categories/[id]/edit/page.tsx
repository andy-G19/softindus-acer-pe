import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { updateExpenseCategoryAction } from "@/modules/petty-cash/categories/actions";
import { ExpenseCategoryForm } from "@/modules/petty-cash/categories/expense-category-form";

type EditExpenseCategoryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditExpenseCategoryPage({
  params,
}: EditExpenseCategoryPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;
  const category = await prisma.categoria_gasto.findUnique({
    where: {
      id_categoria_gasto: id,
    },
  });

  if (!category) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Editar categoría de gasto"
        description="Actualiza la categoría usada para clasificar egresos de caja chica."
        backHref={navigationHrefs.pettyCashCategories}
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Categorías", href: navigationHrefs.pettyCashCategories },
          { label: "Editar categoría" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseCategoryForm
            action={updateExpenseCategoryAction}
            defaultValues={{
              id_categoria_gasto: category.id_categoria_gasto,
              nombre_categoria: category.nombre_categoria,
              descripcion: category.descripcion ?? "",
              estado: String(category.estado),
            }}
            submitLabel="Guardar cambios"
          />
        </CardContent>
      </Card>
    </main>
  );
}
