import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function assertCanViewInventory(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export default async function InventoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  assertCanViewInventory(session.user.role);

  const [materialsCount, suppliersCount, activeAlertsCount, movementsCount] =
    await Promise.all([
      prisma.material.count({
        where: {
          estado: true,
        },
      }),
      prisma.proveedor.count({
        where: {
          estado: true,
        },
      }),
      prisma.alerta_stock.count({
        where: {
          estado_alerta: "activa",
        },
      }),
      prisma.movimiento_inventario.count(),
    ]);

  return (
    <main className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm font-medium text-slate-500">
          Fase 3 · Inventario y proveedores
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Inventario y abastecimiento
        </h1>

        <p className="max-w-3xl text-slate-600">
          Controla materiales, insumos, proveedores, compras, movimientos de
          inventario y alertas de stock bajo.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Materiales activos</p>
          <p className="mt-2 text-3xl font-bold">{materialsCount}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Proveedores activos</p>
          <p className="mt-2 text-3xl font-bold">{suppliersCount}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Alertas activas</p>
          <p className="mt-2 text-3xl font-bold">{activeAlertsCount}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Movimientos registrados</p>
          <p className="mt-2 text-3xl font-bold">{movementsCount}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/inventory/materials"
          className="rounded-xl border bg-white p-6 shadow-sm transition hover:bg-slate-50"
        >
          <h2 className="text-xl font-semibold">Materiales e insumos</h2>
          <p className="mt-2 text-sm text-slate-600">
            Registra materia prima, consumibles, repuestos, herramientas y
            stock mínimo.
          </p>
        </Link>

        <Link
          href="/dashboard/inventory/suppliers"
          className="rounded-xl border bg-white p-6 shadow-sm transition hover:bg-slate-50"
        >
          <h2 className="text-xl font-semibold">Proveedores</h2>
          <p className="mt-2 text-sm text-slate-600">
            Registra proveedores y prepara la asociación con materiales y
            compras.
          </p>
        </Link>
        <Link
          href="/dashboard/inventory/supplier-materials"
          className="rounded-xl border bg-white p-6 shadow-sm transition hover:bg-slate-50"
        >
          <h2 className="text-xl font-semibold">Proveedor-material</h2>
          <p className="mt-2 text-sm text-slate-600">
            Asocia proveedores con los materiales que pueden abastecer.
          </p>
        </Link>

        <Link
          href="/dashboard/inventory/purchases"
         className="rounded-xl border bg-white p-6 shadow-sm transition hover:bg-slate-50"
        >
          <h2 className="text-xl font-semibold">Compras</h2>
          <p className="mt-2 text-sm text-slate-600">
            Registra compras y genera entradas automáticas de inventario.
          </p>
        </Link>

        <Link
          href="/dashboard/inventory/alerts"
          className="rounded-xl border bg-white p-6 shadow-sm transition hover:bg-slate-50"
        >
          <h2 className="text-xl font-semibold">Alertas y stock crítico</h2>
          <p className="mt-2 text-sm text-slate-600">
            Consulta materiales críticos y alertas activas de inventario.
          </p>
        </Link>
        
      </section>
    </main>
  );
}