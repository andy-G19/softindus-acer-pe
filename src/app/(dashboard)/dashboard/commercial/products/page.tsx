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

export default async function ProductsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const products = await prisma.producto.findMany({
    orderBy: {
      fecha_registro: "desc",
    },
  });

  const canCreateProduct = session.user.role === "ADMIN";

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Lista de productos registrados para ventas, pedidos y producción.
          </p>
        </div>

        {canCreateProduct && (
          <Link
            href="/dashboard/commercial/products/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Nuevo producto
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-left">Unidad</th>
              <th className="px-4 py-3 text-left">Precio referencial</th>
              <th className="px-4 py-3 text-left">Estado</th>
            </tr>
          </thead>

          <tbody>
            {products.map((product) => (
              <tr key={product.id_producto} className="border-t">
                <td className="px-4 py-3">{product.id_producto}</td>
                <td className="px-4 py-3 font-medium">
                  {product.nombre_producto}
                </td>
                <td className="px-4 py-3">{product.categoria}</td>
                <td className="px-4 py-3">{product.unidad_medida}</td>
                <td className="px-4 py-3">
                  {formatMoney(product.precio_referencial)}
                </td>
                <td className="px-4 py-3">
                  {product.estado ? "Activo" : "Inactivo"}
                </td>
              </tr>
            ))}

            {products.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavía no hay productos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}