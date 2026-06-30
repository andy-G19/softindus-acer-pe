import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { materialRequirementCalculationSchema } from "@/schemas/production/material-requirement.schema";

type MaterialRequirementsPageProps = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
  searchParams: Promise<{
    quantity?: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function calculateRequiredWithWaste(baseQuantity: number, wastePercentage: number) {
  return baseQuantity * (1 + wastePercentage / 100);
}

function getStockStatusClass(hasEnoughStock: boolean) {
  if (hasEnoughStock) {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-red-50 text-red-700";
}

export default async function MaterialRequirementsPage({
  params,
  searchParams,
}: MaterialRequirementsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id, versionId } = await params;
  const resolvedSearchParams = await searchParams;

  const rawQuantity = resolvedSearchParams.quantity ?? "";

  const parsedQuantity = materialRequirementCalculationSchema.safeParse({
    quantity: rawQuantity || 1,
  });

  const quantityToProduce = parsedQuantity.success
    ? parsedQuantity.data.quantity
    : 1;

  const hasInvalidQuantity = Boolean(rawQuantity) && !parsedQuantity.success;

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

  const calculationRows = version.detalle_receta.map((detail) => {
    const baseQuantityPerUnit = toNumber(detail.cantidad_requerida);
    const wastePercentage = toNumber(detail.merma_estimada_porcentaje);
    const requiredWithoutWaste = baseQuantityPerUnit * quantityToProduce;
    const requiredWithWaste = calculateRequiredWithWaste(
      requiredWithoutWaste,
      wastePercentage,
    );

    const currentStock = toNumber(detail.material.stock_actual);
    const reservedStock = toNumber(detail.material.stock_reservado);
    const availableStock = currentStock - reservedStock;

    const shortage = Math.max(requiredWithWaste - availableStock, 0);
    const hasEnoughStock = availableStock >= requiredWithWaste;

    const unitCost = toNumber(detail.material.costo_unitario_actual);
    const estimatedCost = requiredWithWaste * unitCost;

    return {
      id: detail.id_detalle_receta,
      materialName: detail.material.nombre_material,
      materialCategory: detail.material.categoria,
      materialUnit: detail.material.unidad_medida,
      recipeUnit: detail.unidad_medida,
      consumptionType: detail.tipo_consumo,
      baseQuantityPerUnit,
      requiredWithoutWaste,
      wastePercentage,
      requiredWithWaste,
      currentStock,
      reservedStock,
      availableStock,
      shortage,
      hasEnoughStock,
      unitCost,
      estimatedCost,
      observations: detail.observaciones,
    };
  });

  const totalEstimatedCost = calculationRows.reduce(
    (total, row) => total + row.estimatedCost,
    0,
  );

  const criticalMaterials = calculationRows.filter(
    (row) => !row.hasEnoughStock,
  );

  const availableMaterials = calculationRows.filter(
    (row) => row.hasEnoughStock,
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Producción · Recetas técnicas · Cálculo de materiales
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Cálculo de materiales requeridos
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
      </section>

      {hasInvalidQuantity ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          La cantidad ingresada no es válida. Se está mostrando el cálculo para
          una unidad.
        </section>
      ) : null}

      {version.estado !== "vigente" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta versión no está vigente. El cálculo se muestra solo como
          referencia.
        </section>
      ) : null}

      {version.receta_tecnica.estado !== "activa" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta receta no está activa. El cálculo se muestra solo como
          referencia.
        </section>
      ) : null}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Cantidad a fabricar *
            </label>

            <input
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={quantityToProduce}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />

            <p className="text-xs text-slate-500">
              El sistema multiplicará los materiales de la receta por esta
              cantidad.
            </p>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Calcular
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Cantidad a fabricar</p>
          <p className="mt-2 text-3xl font-bold">
            {formatDecimal(quantityToProduce)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Materiales evaluados</p>
          <p className="mt-2 text-3xl font-bold">
            {calculationRows.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Con stock suficiente</p>
          <p className="mt-2 text-3xl font-bold">
            {availableMaterials.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Costo estimado total</p>
          <p className="mt-2 text-3xl font-bold">
            {formatMoney(totalEstimatedCost)}
          </p>
        </div>
      </section>

      {criticalMaterials.length > 0 ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Hay {criticalMaterials.length} material(es) sin stock suficiente para
          esta producción. Revisa la columna de faltante antes de crear una orden
          de trabajo.
        </section>
      ) : null}

      {version.detalle_receta.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta versión de receta no tiene materiales registrados. Primero agrega
          materiales al detalle de receta.
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Cant. por unidad</th>
              <th className="px-4 py-3 font-semibold">Requerido base</th>
              <th className="px-4 py-3 font-semibold">Merma</th>
              <th className="px-4 py-3 font-semibold">Requerido total</th>
              <th className="px-4 py-3 font-semibold">Stock disponible</th>
              <th className="px-4 py-3 font-semibold">Faltante</th>
              <th className="px-4 py-3 font-semibold">Costo estimado</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>

          <tbody>
            {calculationRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.materialName}</div>

                  <p className="mt-1 text-xs text-slate-500">
                    Categoría: {row.materialCategory}
                  </p>

                  {row.observations ? (
                    <p className="mt-1 max-w-xl text-xs text-slate-500">
                      {row.observations}
                    </p>
                  ) : null}
                </td>

                <td className="px-4 py-3 capitalize">
                  {row.consumptionType}
                </td>

                <td className="px-4 py-3">
                  {formatDecimal(row.baseQuantityPerUnit)} {row.recipeUnit}
                </td>

                <td className="px-4 py-3">
                  {formatDecimal(row.requiredWithoutWaste)} {row.recipeUnit}
                </td>

                <td className="px-4 py-3">
                  {formatDecimal(row.wastePercentage)}%
                </td>

                <td className="px-4 py-3 font-medium">
                  {formatDecimal(row.requiredWithWaste)} {row.recipeUnit}
                </td>

                <td className="px-4 py-3">
                  {formatDecimal(row.availableStock)} {row.materialUnit}
                  <p className="mt-1 text-xs text-slate-400">
                    Stock: {formatDecimal(row.currentStock)} · Reservado:{" "}
                    {formatDecimal(row.reservedStock)}
                  </p>
                </td>

                <td className="px-4 py-3">
                  {formatDecimal(row.shortage)} {row.materialUnit}
                </td>

                <td className="px-4 py-3 font-medium">
                  {formatMoney(row.estimatedCost)}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getStockStatusClass(
                      row.hasEnoughStock,
                    )}`}
                  >
                    {row.hasEnoughStock ? "Suficiente" : "Insuficiente"}
                  </span>
                </td>
              </tr>
            ))}

            {calculationRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  No hay materiales para calcular.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="rounded-xl border bg-slate-50 p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">
          Interpretación del cálculo
        </p>

        <p className="mt-1">
          El sistema usa el stock disponible, es decir, stock actual menos stock
          reservado. Si la cantidad requerida total supera el stock disponible,
          se marca como insuficiente y se muestra el faltante.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Volver al detalle de receta
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