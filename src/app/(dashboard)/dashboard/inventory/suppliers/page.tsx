import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export default async function SuppliersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  const suppliers = await prisma.proveedor.findMany({
    orderBy: {
      razon_social: "asc",
    },
  });

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Inventario · Proveedores
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-slate-600">
            Registra proveedores de materia prima, consumibles, repuestos y
            servicios.
          </p>
        </div>

        <Link
          href="/dashboard/inventory/suppliers/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nuevo proveedor
        </Link>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Razón social</th>
              <th className="px-4 py-3 font-semibold">Documento</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Teléfono</th>
              <th className="px-4 py-3 font-semibold">Condición de pago</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>

          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id_proveedor} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  {supplier.id_proveedor}
                </td>
                <td className="px-4 py-3 font-medium">
                  {supplier.razon_social}
                </td>
                <td className="px-4 py-3">
                  {supplier.numero_documento
                    ? `${supplier.tipo_documento ?? "-"} ${supplier.numero_documento}`
                    : "-"}
                </td>
                <td className="px-4 py-3">{supplier.tipo_proveedor}</td>
                <td className="px-4 py-3">{supplier.telefono ?? "-"}</td>
                <td className="px-4 py-3">{supplier.condicion_pago ?? "-"}</td>
                <td className="px-4 py-3">
                  {supplier.estado ? "Activo" : "Inactivo"}
                </td>
              </tr>
            ))}

            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay proveedores registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}