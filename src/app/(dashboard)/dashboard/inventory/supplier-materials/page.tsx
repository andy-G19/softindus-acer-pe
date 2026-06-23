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

export default async function SupplierMaterialsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/access-denied");
  }

  const relations = await prisma.proveedor_material.findMany({
    orderBy: {
      fecha_actualizacion: "desc",
    },
  });

  const supplierIds = [...new Set(relations.map((item) => item.id_proveedor))];
  const materialIds = [...new Set(relations.map((item) => item.id_material))];

  const [suppliers, materials] = await Promise.all([
    prisma.proveedor.findMany({
      where: {
        id_proveedor: {
          in: supplierIds,
        },
      },
    }),
    prisma.material.findMany({
      where: {
        id_material: {
          in: materialIds,
        },
      },
    }),
  ]);

  const supplierById = new Map(
    suppliers.map((supplier) => [supplier.id_proveedor, supplier]),
  );

  const materialById = new Map(
    materials.map((material) => [material.id_material, material]),
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Proveedor-material
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Materiales por proveedor
          </h1>
          <p className="text-slate-600">
            Consulta qué proveedores abastecen cada material o insumo.
          </p>
        </div>

        <Link
          href="/dashboard/inventory/supplier-materials/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva asociación
        </Link>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Proveedor</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Unidad</th>
              <th className="px-4 py-3 font-semibold">Precio referencial</th>
              <th className="px-4 py-3 font-semibold">Entrega</th>
              <th className="px-4 py-3 font-semibold">Disponibilidad</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>

          <tbody>
            {relations.map((relation) => {
              const supplier = supplierById.get(relation.id_proveedor);
              const material = materialById.get(relation.id_material);

              return (
                <tr key={relation.id_proveedor_material} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {relation.id_proveedor_material}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {supplier?.razon_social ?? relation.id_proveedor}
                  </td>
                  <td className="px-4 py-3">
                    {material?.nombre_material ?? relation.id_material}
                  </td>
                  <td className="px-4 py-3">{relation.unidad_medida}</td>
                  <td className="px-4 py-3">
                    {formatMoney(relation.precio_referencial)}
                  </td>
                  <td className="px-4 py-3">
                    {relation.tiempo_entrega_dias
                      ? `${relation.tiempo_entrega_dias} días`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {relation.disponibilidad ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    {relation.estado ? "Activo" : "Inactivo"}
                  </td>
                </tr>
              );
            })}

            {relations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay asociaciones proveedor-material.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}