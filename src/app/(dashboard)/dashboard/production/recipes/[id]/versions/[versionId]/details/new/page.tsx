import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createRecipeDetailAction } from "@/modules/production/recipe-details/actions";

type NewRecipeDetailPageProps = {
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
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "S/ 0.00";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

export default async function NewRecipeDetailPage({
  params,
}: NewRecipeDetailPageProps) {
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
        select: {
          id_material: true,
        },
      },
    },
  });

  if (!version) {
    notFound();
  }

  const usedMaterialIds = version.detalle_receta.map(
    (detail) => detail.id_material,
  );

  const materials = await prisma.material.findMany({
    where: {
      estado: true,
      id_material: {
        notIn: usedMaterialIds,
      },
    },
    orderBy: [
      {
        categoria: "asc",
      },
      {
        nombre_material: "asc",
      },
    ],
  });

  const canAddDetail =
    version.estado === "vigente" &&
    version.receta_tecnica.estado === "activa" &&
    materials.length > 0;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Producción · Recetas técnicas · Materiales requeridos
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Agregar material a receta
        </h1>

        <p className="mt-2 text-slate-600">
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
      </section>

      {version.estado !== "vigente" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta versión no está vigente. Solo se pueden agregar materiales a una
          versión vigente.
        </section>
      ) : null}

      {version.receta_tecnica.estado !== "activa" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta receta no está activa. Actívala antes de agregar materiales.
        </section>
      ) : null}

      {materials.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          No hay materiales activos disponibles o todos los materiales activos ya
          fueron agregados a esta versión de receta.
        </section>
      ) : null}

      <form
        action={createRecipeDetailAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <input
          type="hidden"
          name="id_version_receta"
          value={version.id_version_receta}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">Material o insumo *</label>

          <select
            name="id_material"
            required
            disabled={!canAddDetail}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          >
            <option value="">Seleccione un material</option>

            {materials.map((material) => (
              <option key={material.id_material} value={material.id_material}>
                {material.nombre_material} · {material.categoria} · Stock:{" "}
                {formatDecimal(material.stock_actual)} {material.unidad_medida} ·{" "}
                {formatMoney(material.costo_unitario_actual)}
              </option>
            ))}
          </select>

          <p className="text-xs text-slate-500">
            La unidad de medida se tomará automáticamente desde el material
            registrado en inventario.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Cantidad requerida por unidad *
            </label>

            <input
              name="cantidad_requerida"
              type="number"
              min="0.01"
              step="0.01"
              required
              disabled={!canAddDetail}
              placeholder="Ej. 1.20"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Merma estimada (%)
            </label>

            <input
              name="merma_estimada_porcentaje"
              type="number"
              min="0"
              max="100"
              step="0.01"
              disabled={!canAddDetail}
              placeholder="Ej. 5"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de consumo *</label>

          <select
            name="tipo_consumo"
            required
            disabled={!canAddDetail}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          >
            <option value="">Seleccione el tipo</option>
            <option value="materia_prima">Materia prima</option>
            <option value="consumible">Consumible</option>
            <option value="auxiliar">Auxiliar</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Observaciones</label>

          <textarea
            name="observaciones"
            rows={4}
            maxLength={700}
            disabled={!canAddDetail}
            placeholder="Ej. Considerar margen adicional si la plancha viene con defectos o cortes irregulares."
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>

        <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Importante</p>

          <p className="mt-1">
            La cantidad registrada representa el consumo estimado para fabricar
            una unidad del producto. En la siguiente fase usaremos estos datos
            para calcular materiales requeridos según la cantidad a producir.
          </p>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href={`/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={!canAddDetail}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Guardar material
          </button>
        </div>
      </form>
    </main>
  );
}