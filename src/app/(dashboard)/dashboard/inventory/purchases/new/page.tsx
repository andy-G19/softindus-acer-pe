import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PurchaseForm } from "@/components/inventory/purchase-form";

export default async function NewPurchasePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/access-denied");
  }

  const [suppliers, materials] = await Promise.all([
    prisma.proveedor.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        razon_social: "asc",
      },
      select: {
        id_proveedor: true,
        razon_social: true,
      },
    }),
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        unidad_medida: true,
        costo_unitario_actual: true,
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Inventario · Compras
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Nueva compra
        </h1>
        <p className="text-slate-600">
          Registra una compra de materiales y genera automáticamente la entrada
          de inventario.
        </p>
      </section>

      <PurchaseForm
        suppliers={suppliers}
        materials={materials.map((material) => ({
          id_material: material.id_material,
          nombre_material: material.nombre_material,
          unidad_medida: material.unidad_medida,
          costo_unitario_actual: material.costo_unitario_actual.toString(),
        }))}
      />
    </main>
  );
}