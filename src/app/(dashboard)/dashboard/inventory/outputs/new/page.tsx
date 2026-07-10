
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createInventoryOutputAction } from "@/modules/inventory/movements/actions";
import { InventoryOutputForm } from "@/modules/inventory/movements/inventory-output-form";

export default async function NewInventoryOutputPage() {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const [materials, workOrders] = await Promise.all([
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
        stock_actual: true,
        stock_reservado: true,
      },
    }),
    prisma.orden_trabajo.findMany({
      where: {
        estado: {
          notIn: ["finalizada", "cancelada"],
        },
      },
      orderBy: {
        fecha_inicio: "desc",
      },
      select: {
        id_orden_trabajo: true,
        estado: true,
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Registrar salida de inventario"
        description="La salida descuenta stock actual y registra stock anterior/resultante."
        backHref={navigationHrefs.inventoryOutputs}
        backLabel="Volver a salidas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Salidas", href: navigationHrefs.inventoryOutputs },
          { label: "Registrar salida" },
        ])}
      />

      <InventoryOutputForm
        action={createInventoryOutputAction}
        materials={materials.map((material) => {
          const disponible =
            Number(material.stock_actual.toString()) -
            Number(material.stock_reservado.toString());

          return {
            id: material.id_material,
            label: `${material.nombre_material} (${disponible.toFixed(2)} ${material.unidad_medida} disponible)`,
          };
        })}
        workOrders={workOrders.map((order) => ({
          id: order.id_orden_trabajo,
          label: `${order.id_orden_trabajo} - ${order.estado}`,
        }))}
      />
    </main>
  );
}
