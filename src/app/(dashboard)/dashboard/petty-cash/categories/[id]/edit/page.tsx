import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard - Caja chica y finanzas - Editar categoria
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Editar categoria de gasto
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Actualiza la categoria usada para clasificar egresos de caja chica.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>Solo ADMIN</Badge>
          <Link
            href="/dashboard/petty-cash/categories"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al listado
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la categoria</CardTitle>
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
