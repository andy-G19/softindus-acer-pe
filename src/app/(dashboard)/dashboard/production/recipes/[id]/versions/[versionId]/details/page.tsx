import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

type RecipeDetailsPageProps = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value.toString()).toFixed(2);
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "S/ 0.00";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function calculateRequiredWithWaste(quantity: unknown, waste: unknown) {
  const baseQuantity = Number(quantity?.toString() ?? 0);
  const wastePercentage = Number(waste?.toString() ?? 0);

  return baseQuantity * (1 + wastePercentage / 100);
}

export default async function RecipeDetailsPage({
  params,
}: RecipeDetailsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id, versionId } = await params;

  const version = await prisma.version_receta.findFirst({
    where: {
      id_version_receta: versionId,
      id_receta: id,
    },
    include: {
      receta_tecnica: {
        include: {
          producto: true,
        },
      },
      detalle_receta: {
        include: {
          material: true,
        },
        orderBy: {
          id_detalle_receta: "asc",
        },
      },
    },
  });

  if (!version) {
    notFound();
  }

  const estimatedUnitCost = version.detalle_receta.reduce((total, detail) => {
    const requiredWithWaste = calculateRequiredWithWaste(
      detail.cantidad_requerida,
      detail.merma_estimada_porcentaje,
    );

    const unitCost = Number(detail.material.costo_unitario_actual.toString());

    return total + requiredWithWaste * unitCost;
  }, 0);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Producción · Recetas técnicas · Materiales requeridos
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Detalle de receta
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Receta:{" "}
            <span className="font-medium">
              {version.receta_tecnica.nombre_receta}
            </span>{" "}
            · Versión:{" "}
            <span className="font-medium">{version.numero_version}</span> ·
            Producto:{" "}
            <span className="font-medium">
              {version.receta_tecnica.producto.nombre_producto}
            </span>
          </p>
        </div>

       <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/requirements`}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Calcular materiales
          </Link>

          <Link
            href={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details/new`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Agregar material
          </Link>
        </div>

      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Materiales registrados</p>
          <p className="mt-2 text-3xl font-bold">
            {version.detalle_receta.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Materia prima</p>
          <p className="mt-2 text-3xl font-bold">
            {
              version.detalle_receta.filter(
                (detail) => detail.tipo_consumo === "materia prima",
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Consumibles</p>
          <p className="mt-2 text-3xl font-bold">
            {
              version.detalle_receta.filter(
                (detail) => detail.tipo_consumo === "consumible",
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Costo estimado por unidad
          </p>
          <p className="mt-2 text-3xl font-bold">
            {formatMoney(estimatedUnitCost)}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Tipo consumo</th>
              <th className="px-4 py-3 font-semibold">Cantidad base</th>
              <th className="px-4 py-3 font-semibold">Merma</th>
              <th className="px-4 py-3 font-semibold">Cant. con merma</th>
              <th className="px-4 py-3 font-semibold">Costo unitario</th>
              <th className="px-4 py-3 font-semibold">Costo estimado</th>
              <th className="px-4 py-3 font-semibold">Stock actual</th>
            </tr>
          </thead>

          <tbody>
            {version.detalle_receta.map((detail) => {
              const requiredWithWaste = calculateRequiredWithWaste(
                detail.cantidad_requerida,
                detail.merma_estimada_porcentaje,
              );

              const unitCost = Number(
                detail.material.costo_unitario_actual.toString(),
              );

              const estimatedCost = requiredWithWaste * unitCost;

              return (
                <tr key={detail.id_detalle_receta} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {detail.id_detalle_receta}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {detail.material.nombre_material}
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Categoría: {detail.material.categoria}
                    </p>

                    {detail.observaciones ? (
                      <p className="mt-1 max-w-xl text-xs text-slate-500">
                        {detail.observaciones}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-3 capitalize">
                    {detail.tipo_consumo}
                  </td>

                  <td className="px-4 py-3">
                    {formatDecimal(detail.cantidad_requerida)}{" "}
                    {detail.unidad_medida}
                  </td>

                  <td className="px-4 py-3">
                    {detail.merma_estimada_porcentaje
                      ? `${formatDecimal(
                          detail.merma_estimada_porcentaje,
                        )}%`
                      : "0.00%"}
                  </td>

                  <td className="px-4 py-3">
                    {requiredWithWaste.toFixed(2)} {detail.unidad_medida}
                  </td>

                  <td className="px-4 py-3">
                    {formatMoney(detail.material.costo_unitario_actual)}
                  </td>

                  <td className="px-4 py-3 font-medium">
                    {formatMoney(estimatedCost)}
                  </td>

                  <td className="px-4 py-3">
                    {formatDecimal(detail.material.stock_actual)}{" "}
                    {detail.material.unidad_medida}
                  </td>
                </tr>
              );
            })}

            {version.detalle_receta.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay materiales registrados para esta versión de
                  receta.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="rounded-xl border bg-slate-50 p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">
          Nota sobre el cálculo mostrado
        </p>

        <p className="mt-1">
          El costo estimado por unidad se calcula usando la cantidad requerida,
          la merma estimada y el costo unitario actual del material. En la
          siguiente fase multiplicaremos estos valores por la cantidad a fabricar
          y validaremos stock suficiente.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/production/recipes/${version.id_receta}/versions`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Volver a versión
        </Link>

        <Link
          href="/dashboard/production/recipes"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver a recetas técnicas
        </Link>
      </div>
    </main>
  );
}