import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function assertCanViewInventory(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

export default async function MaterialsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  assertCanViewInventory(session.user.role);

  const isAdmin = session.user.role === "ADMIN";

  const materials = await prisma.material.findMany({
    orderBy: {
      fecha_registro: "desc",
    },
  });

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Materiales
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Materiales e insumos
          </h1>
          <p className="text-slate-600">
            Consulta stock actual, stock reservado, stock mínimo y costo vigente.
          </p>
        </div>

        {isAdmin ? (
          <Link
            href="/dashboard/inventory/materials/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Nuevo material
          </Link>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Unidad</th>
              <th className="px-4 py-3 font-semibold">Stock actual</th>
              <th className="px-4 py-3 font-semibold">Reservado</th>
              <th className="px-4 py-3 font-semibold">Disponible</th>
              <th className="px-4 py-3 font-semibold">Stock mínimo</th>
              <th className="px-4 py-3 font-semibold">Costo actual</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>

          <tbody>
            {materials.map((material) => {
              const stockActual = Number(material.stock_actual.toString());
              const stockReservado = Number(material.stock_reservado.toString());
              const stockMinimo = Number(material.stock_minimo.toString());
              const stockDisponible = stockActual - stockReservado;
              const isLowStock =
                stockMinimo > 0 && stockDisponible <= stockMinimo;

              return (
                <tr key={material.id_material} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {material.id_material}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {material.nombre_material}
                  </td>
                  <td className="px-4 py-3">{material.categoria}</td>
                  <td className="px-4 py-3">{material.unidad_medida}</td>
                  <td className="px-4 py-3">{formatDecimal(material.stock_actual)}</td>
                  <td className="px-4 py-3">
                    {formatDecimal(material.stock_reservado)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        isLowStock
                          ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                          : "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                      }
                    >
                      {stockDisponible.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDecimal(material.stock_minimo)}</td>
                  <td className="px-4 py-3">
                    {formatMoney(material.costo_unitario_actual)}
                  </td>
                  <td className="px-4 py-3">
                    {material.estado ? "Activo" : "Inactivo"}
                  </td>
                </tr>
              );
            })}

            {materials.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay materiales registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}