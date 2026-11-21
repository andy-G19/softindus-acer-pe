import { CalendarCheck, CalendarClock, CircleDollarSign, Route } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDecimal, formatMoney } from "@/lib/formatters";
import {
  calculatePendingDelivery,
  summarizeMaterialLine,
} from "@/lib/material-reconciliation";
import { applyWaste, roundQuantity } from "@/lib/recipe-quantities";
import { DeliverPendingAction } from "@/modules/production/work-orders/deliver-pending-action";
import { MaterialClosureSection } from "@/modules/production/work-orders/material-closure-section";
import { MaterialMovementForm } from "@/modules/production/work-orders/material-movement-form";
import { getWorkOrderDetail } from "@/modules/production/work-orders/queries";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { formatCents } from "@/lib/decimal-cents";
import { pendingDeliveryQuantity, quantityHundredths } from "@/lib/material-quantities";
import { toNumber } from "@/lib/numbers";
import { productionNotifications } from "@/modules/production/notifications";
import {
  closeWorkOrderMaterialsAction,
  deliverAdditionalMaterialAction,
  deliverWorkOrderMaterialsAction,
  reopenWorkOrderMaterialsAction,
  returnWorkOrderMaterialAction,
} from "@/modules/production/work-orders/actions";

type WorkOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Disponible, faltante y si el stock alcanza, en centesimos como guardan sus columnas
 * numeric(10, 2) (C4 de la 11.6a, D65, hallazgo 27 de la 10.6b). En number, 0.30 - 0.10 daba
 * 0.19999999999999998: frente a 0.20 la fila decia «Insuficiente» con un faltante de «0.00».
 */
function stockCoverage(currentStock: unknown, reservedStock: unknown, required: number) {
  const available =
    quantityHundredths(String(currentStock ?? 0)) - quantityHundredths(String(reservedStock ?? 0));
  const requiredHundredths = quantityHundredths(required);
  const shortage = requiredHundredths > available ? requiredHundredths - available : 0n;

  return {
    availableStock: toNumber(formatCents(available)),
    shortage: toNumber(formatCents(shortage)),
    hasEnoughStock: available >= requiredHundredths,
  };
}

function getOrderBadgeVariant(status: string) {
  if (status === "finalizada") {
    return "success" as const;
  }

  if (status === "en_proceso") {
    return "info" as const;
  }

  if (status === "pausada") {
    return "warning" as const;
  }

  if (status === "anulada") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: WorkOrderDetailPageProps) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  const workOrder = await getWorkOrderDetail(id);

  if (!workOrder) {
    notFound();
  }

  const quantityToProduce = toNumber(workOrder.cantidad);

  /**
   * Las órdenes creadas desde la fase C traen su requerimiento congelado. Las anteriores
   * no lo tienen, así que se recalcula desde la receta: sin ese fallback, todas las
   * órdenes históricas mostrarían la tabla vacía.
   */
  const hasFrozenRequirement =
    workOrder.requerimiento_orden_material.length > 0;

  const materialRows = hasFrozenRequirement
    ? workOrder.requerimiento_orden_material.map((requirement) => {
        const baseQuantityPerUnit = toNumber(requirement.cantidad_por_unidad);
        const wastePercentage = toNumber(
          requirement.merma_estimada_porcentaje,
        );
        const requiredWithWaste = toNumber(requirement.cantidad_requerida);

        const currentStock = toNumber(requirement.material.stock_actual);
        const reservedStock = toNumber(requirement.material.stock_reservado);
        const coverage = stockCoverage(
          requirement.material.stock_actual,
          requirement.material.stock_reservado,
          requiredWithWaste,
        );

        // El costo es el congelado al crear la orden, no el actual: así el costo
        // planificado no cambia cada vez que llega una compra nueva.
        const unitCost = toNumber(requirement.costo_unitario_registrado);

        return {
          id: requirement.id_requerimiento,
          materialName: requirement.material.nombre_material,
          materialCategory: requirement.material.categoria,
          unit: requirement.unidad_medida,
          materialUnit: requirement.material.unidad_medida,
          consumptionType: requirement.tipo_consumo,
          baseQuantityPerUnit,
          requiredWithoutWaste: baseQuantityPerUnit * quantityToProduce,
          wastePercentage,
          requiredWithWaste,
          currentStock,
          reservedStock,
          ...coverage,
          estimatedCost: requiredWithWaste * unitCost,
        };
      })
    : (workOrder.version_receta?.detalle_receta.map((detail) => {
        const baseQuantityPerUnit = toNumber(detail.cantidad_requerida);
        const wastePercentage = toNumber(detail.merma_estimada_porcentaje);

        const requiredWithoutWaste = baseQuantityPerUnit * quantityToProduce;
        // Redondeado antes de comparar contra el stock: sin esto, el ruido de coma
        // flotante (50 * 1.1 = 55.00000000000001) reporta faltante cuando el stock
        // alcanza justo.
        const requiredWithWaste = roundQuantity(
          applyWaste(requiredWithoutWaste, wastePercentage),
        );

        const currentStock = toNumber(detail.material.stock_actual);
        const reservedStock = toNumber(detail.material.stock_reservado);
        const coverage = stockCoverage(
          detail.material.stock_actual,
          detail.material.stock_reservado,
          requiredWithWaste,
        );

        const unitCost = toNumber(detail.material.costo_unitario_actual);

        return {
          id: detail.id_detalle_receta,
          materialName: detail.material.nombre_material,
          materialCategory: detail.material.categoria,
          unit: detail.unidad_medida,
          materialUnit: detail.material.unidad_medida,
          consumptionType: detail.tipo_consumo,
          baseQuantityPerUnit,
          requiredWithoutWaste,
          wastePercentage,
          requiredWithWaste,
          currentStock,
          reservedStock,
          ...coverage,
          estimatedCost: requiredWithWaste * unitCost,
        };
      }) ?? []);

  const totalEstimatedCost = materialRows.reduce(
    (total, row) => total + row.estimatedCost,
    0,
  );

  const criticalMaterials = materialRows.filter(
    (row) => !row.hasEnoughStock,
  );

  // Lo pendiente sale del requerimiento congelado, no de "existe alguna salida": desde que
  // se admiten entregas adicionales, la sola existencia de un movimiento ya no significa
  // que la orden esté servida.
  const pendingDeliveryTotal = workOrder.requerimiento_orden_material.reduce(
    (total, requirement) =>
      total +
      calculatePendingDelivery({
        required: requirement.cantidad_requerida,
        delivered: requirement.cantidad_entregada,
      }),
    0,
  );

  const hasDeliveries = workOrder.requerimiento_orden_material.some(
    (requirement) => toNumber(requirement.cantidad_entregada) > 0,
  );

  const materialsClosed = Boolean(workOrder.fecha_cierre_materiales);

  // Solo ADMIN: el maestro de taller concilia y cierra, el administrador corrige. Reabrir
  // habilita reescribir la merma declarada, así que el permiso se separa de la operación
  // diaria a propósito.
  const canReopenMaterials =
    materialsClosed &&
    session.user.role === "ADMIN" &&
    workOrder.estado !== "anulada";

  const reconciliationRows = workOrder.requerimiento_orden_material.map(
    (requirement) => ({
      idRequerimiento: requirement.id_requerimiento,
      materialName: requirement.material.nombre_material,
      unidad: requirement.unidad_medida,
      stockActual: toNumber(requirement.material.stock_actual),
      ...summarizeMaterialLine({
        required: requirement.cantidad_requerida,
        delivered: requirement.cantidad_entregada,
        returned: requirement.cantidad_devuelta,
        consumed: requirement.cantidad_consumida,
      }),
    }),
  );

  const canDeliverMaterials =
    ["ADMIN", "WORKSHOP_MASTER"].includes(session.user.role ?? "") &&
    !["anulada", "finalizada"].includes(workOrder.estado) &&
    hasFrozenRequirement &&
    !materialsClosed &&
    pendingDeliveryTotal > 0;

  // C3 de la 11.6b (D75): lo que dice la confirmacion es lo que entrega la accion, con la misma
  // funcion y el mismo filtro de las lineas en 0.00.
  const pendingDeliveryLines = workOrder.requerimiento_orden_material
    .map((requirement) => ({
      materialName: requirement.material.nombre_material,
      quantity: pendingDeliveryQuantity({
        required: requirement.cantidad_requerida,
        delivered: requirement.cantidad_entregada,
      }),
      unidad: requirement.unidad_medida,
    }))
    .filter((line) => quantityHundredths(line.quantity) > 0n);
  const backHref = getSafeReturnTo(
    queryParams.returnTo,
    navigationHrefs.workOrders,
  );

  const origin =
    workOrder.tipo_produccion === "pedido"
      ? workOrder.detalle_pedido?.pedido.cliente.nombre_razon_social ??
        workOrder.cliente?.nombre_razon_social ??
        "Pedido"
      : workOrder.tipo_produccion === "campania"
        ? workOrder.campania_produccion?.nombre_campania ?? "Campaña"
        : "Reposición de stock";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Orden ${workOrder.id_orden_trabajo}`}
        description={`Producto: ${workOrder.producto.nombre_producto} · Cantidad: ${formatDecimal(workOrder.cantidad)} ${workOrder.producto.unidad_medida}`}
        backHref={backHref}
        backLabel="Volver a órdenes"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Órdenes de trabajo", href: backHref },
          { label: workOrder.id_orden_trabajo },
        ])}
        actions={
          <>
            {materialsClosed ? (
              <Badge variant="success">Materiales cerrados</Badge>
            ) : hasDeliveries && pendingDeliveryTotal === 0 ? (
              <Badge variant="info">Materiales entregados</Badge>
            ) : null}

            {canDeliverMaterials ? (
              <DeliverPendingAction
                idOrdenTrabajo={workOrder.id_orden_trabajo}
                hasDeliveries={hasDeliveries}
                lines={pendingDeliveryLines}
                action={deliverWorkOrderMaterialsAction}
                successNotification={productionNotifications["work-order-materials-delivered"]}
              />
            ) : null}

            <Button variant="outline" asChild>
              <Link
                href={`${navigationHrefs.workOrders}/${workOrder.id_orden_trabajo}/progress`}
              >
                Ver avances
              </Link>
            </Button>

            <Badge variant={getOrderBadgeVariant(workOrder.estado)}>
              {workOrder.estado}
            </Badge>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Origen" value={origin} description="Origen de la orden." tone="info" icon={Route} />
        <KpiCard title="Inicio" value={formatDate(workOrder.fecha_inicio, { format: "d mmm yyyy" })} description="Fecha de inicio." tone="info" icon={CalendarCheck} />
        <KpiCard title="Entrega estimada" value={formatDate(workOrder.fecha_entrega_estimada, { format: "d mmm yyyy" })} description="Compromiso de entrega." tone="info" icon={CalendarClock} />
        <KpiCard title="Costo material estimado" value={formatMoney(totalEstimatedCost)} description="Con merma incluida." tone="warning" icon={CircleDollarSign} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ruta de fabricación</CardTitle>
            <p className="text-sm text-muted-foreground">
              {workOrder.ruta_fabricacion?.nombre_ruta ?? "Sin ruta asociada"}
            </p>
          </CardHeader>

          <CardContent className="space-y-3">
            {workOrder.ruta_fabricacion?.etapa_ruta.map((stage) => (
              <div
                key={stage.id_etapa_ruta}
                className="rounded-lg border border-border bg-secondary/40 p-3 text-sm"
              >
                <p className="font-medium">
                  {stage.orden_secuencia}. {stage.nombre_etapa}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {stage.requiere_maquina
                    ? "Requiere máquina"
                    : "No requiere máquina"}
                </p>
              </div>
            ))}

            {workOrder.ruta_fabricacion?.etapa_ruta.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta ruta no tiene etapas activas.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receta técnica</CardTitle>
            <p className="text-sm text-muted-foreground">
              {workOrder.version_receta?.receta_tecnica.nombre_receta ??
                "Sin receta asociada"}
            </p>
          </CardHeader>

          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Versión:</span>{" "}
              {workOrder.version_receta?.numero_version ?? "-"}
            </p>

            <p>
              <span className="font-medium">Materiales:</span>{" "}
              {workOrder.version_receta?.detalle_receta.length ?? 0}
            </p>

            <p>
              <span className="font-medium">Registrada por:</span>{" "}
              {workOrder.usuario.nombres} {workOrder.usuario.apellidos}
            </p>

            {workOrder.observaciones ? (
              <p className="pt-2 text-muted-foreground">
                {workOrder.observaciones}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {criticalMaterials.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            Hay {criticalMaterials.length} material(es) sin stock suficiente
            para esta orden. Revisa la columna de faltante antes de iniciar la
            producción.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Materiales requeridos para la orden
          </CardTitle>

          {hasFrozenRequirement ? (
            <p className="text-sm text-muted-foreground">
              Requerimiento congelado al crear la orden. Las cantidades y el
              costo unitario no cambian aunque después se edite la receta o
              varíe el precio del material.
            </p>
          ) : (
            <Alert variant="warning">
              <AlertDescription>
                Orden anterior al congelado de requerimientos: las cantidades se
                recalculan desde la receta vigente y el costo usa el precio
                actual del material, así que pueden diferir de lo planificado el
                día en que se creó.
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cant. por unidad</TableHead>
                <TableHead>Requerido total</TableHead>
                <TableHead>Stock disponible</TableHead>
                <TableHead>Faltante</TableHead>
                <TableHead>Costo estimado</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {materialRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell data-cell="text">
                    <div className="font-medium">{row.materialName}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Categoría: {row.materialCategory}
                    </p>
                  </TableCell>

                  <TableCell className="capitalize">
                    {row.consumptionType}
                  </TableCell>

                  <TableCell>
                    {formatDecimal(row.baseQuantityPerUnit)} {row.unit}
                  </TableCell>

                  <TableCell className="font-medium">
                    {formatDecimal(row.requiredWithWaste)} {row.unit}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Incluye merma: {formatDecimal(row.wastePercentage)}%
                    </p>
                  </TableCell>

                  <TableCell>
                    {formatDecimal(row.availableStock)} {row.materialUnit}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Stock: {formatDecimal(row.currentStock)} · Reservado:{" "}
                      {formatDecimal(row.reservedStock)}
                    </p>
                  </TableCell>

                  <TableCell>
                    {formatDecimal(row.shortage)} {row.materialUnit}
                  </TableCell>

                  <TableCell className="font-medium">
                    {formatMoney(row.estimatedCost)}
                  </TableCell>

                  <TableCell>
                    <Badge variant={row.hasEnoughStock ? "success" : "destructive"}>
                      {row.hasEnoughStock ? "Suficiente" : "Insuficiente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}

              {materialRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      className="border-0"
                      label="Esta orden no tiene materiales calculados."
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {hasFrozenRequirement && !["anulada"].includes(workOrder.estado) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Conciliación de materiales
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Entregado = consumido + devuelto + merma. La merma no se captura:
              sale por diferencia.
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Requerido</TableHead>
                    <TableHead>Entregado</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead>Devuelto</TableHead>
                    <TableHead>Consumido</TableHead>
                    <TableHead>Merma</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {reconciliationRows.map((row) => (
                    <TableRow key={row.idRequerimiento}>
                      <TableCell data-cell="text">
                        <span className="font-medium">{row.materialName}</span>
                        {row.overDelivered ? (
                          <Badge variant="warning" className="mt-1">
                            Entregado por encima del plan
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {row.required.toFixed(2)} {row.unidad}
                      </TableCell>
                      <TableCell>{row.delivered.toFixed(2)}</TableCell>
                      <TableCell>
                        {row.pendingDelivery > 0
                          ? row.pendingDelivery.toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell>{row.returned.toFixed(2)}</TableCell>
                      <TableCell>
                        {materialsClosed ? row.consumed.toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {materialsClosed ? row.waste.toFixed(2) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* C2 de la 11.6b (D74): la seccion queda montada al cerrar y al reabrir para dar su aviso. */}
            <MaterialClosureSection
              idOrdenTrabajo={workOrder.id_orden_trabajo}
              closed={materialsClosed}
              canReopen={canReopenMaterials}
              hasDeliveries={hasDeliveries}
              closedSummary={
                <Alert variant="success">
                  <AlertDescription>
                    Materiales cerrados el{" "}
                    {formatDate(workOrder.fecha_cierre_materiales, { format: "d mmm yyyy" })}. Unidades
                    producidas:{" "}
                    <strong>
                      {formatDecimal(workOrder.cantidad_producida ?? 0)}{" "}
                      {workOrder.producto.unidad_medida}
                    </strong>{" "}
                    de {formatDecimal(workOrder.cantidad)} planificadas.
                  </AlertDescription>
                </Alert>
              }
              movementForm={
                <MaterialMovementForm
                  idOrdenTrabajo={workOrder.id_orden_trabajo}
                  additionalAction={deliverAdditionalMaterialAction}
                  returnAction={returnWorkOrderMaterialAction}
                  additionalNotification={productionNotifications["work-order-additional-delivery"]}
                  returnNotification={productionNotifications["work-order-material-returned"]}
                  options={reconciliationRows.map((row) => ({
                    idRequerimiento: row.idRequerimiento,
                    materialName: row.materialName,
                    unidad: row.unidad,
                    stockActual: row.stockActual,
                    returnable: Number(
                      (row.delivered - row.returned).toFixed(2),
                    ),
                  }))}
                />
              }
              productUnit={workOrder.producto.unidad_medida}
              lines={reconciliationRows.map((row) => ({
                idRequerimiento: row.idRequerimiento,
                materialName: row.materialName,
                unidad: row.unidad,
                delivered: row.delivered,
                returned: row.returned,
              }))}
              closeAction={closeWorkOrderMaterialsAction}
              reopenAction={reopenWorkOrderMaterialsAction}
              closeNotification={productionNotifications["work-order-materials-closed"]}
              reopenNotification={productionNotifications["work-order-materials-reopened"]}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
