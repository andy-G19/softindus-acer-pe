import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { prisma } from "@/lib/db";
import {
  createIndirectCostAction,
  annulIndirectCostAction,
} from "@/modules/costs/indirect-costs/actions";
import {
  recalculateCostingAction,
  updateLaborCostAction,
} from "@/modules/costs/costings/actions";
import { createMarginAction } from "@/modules/costs/margins/actions";
import { createProfitabilityAction } from "@/modules/costs/profitability/actions";

type CostingDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(value);
}

function formatShortDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(2)}%`;
}

function getCostTypeLabel(type: string) {
  if (type === "materia_prima") {
    return "Material";
  }

  if (type === "consumible") {
    return "Consumible";
  }

  if (type === "auxiliar") {
    return "Auxiliar";
  }

  return type;
}

function getIndirectCostCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    luz: "Luz",
    desgaste_maquinaria: "Desgaste de maquinaria",
    transporte: "Transporte",
    mantenimiento: "Mantenimiento",
    alquiler: "Alquiler",
    mano_obra_indirecta: "Mano de obra indirecta",
    otros: "Otros",
  };

  return labels[category] ?? category;
}

function getSuggestedPrice(totalCost: unknown, marginPercentage: number) {
  return toNumber(totalCost) * (1 + marginPercentage / 100);
}

function getProfitabilityReference(
  totalCost: unknown,
  price: unknown,
  expectedMargin: unknown,
) {
  const income = toNumber(price);
  const cost = toNumber(totalCost);
  const expected = toNumber(expectedMargin);

  if (income <= 0 || cost <= 0) {
    return {
      income: 0,
      profit: 0,
      realMargin: 0,
      lowMarginAlert: true,
    };
  }

  const profit = income - cost;
  const realMargin = (profit / cost) * 100;
  const lowMarginAlert = realMargin < expected;

  return {
    income,
    profit,
    realMargin,
    lowMarginAlert,
  };
}

export default async function CostingDetailPage({
  params,
}: CostingDetailPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const { id } = await params;

  const costing = await prisma.costeo.findUnique({
    where: {
      id_costeo: id,
    },
    include: {
      usuario: true,
      pedido: {
        include: {
          cliente: true,
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
          cliente: true,
          detalle_pedido: {
            include: {
              pedido: {
                include: {
                  cliente: true,
                },
              },
            },
          },
          version_receta: {
            include: {
              receta_tecnica: true,
              detalle_receta: {
                include: {
                  material: true,
                },
                orderBy: {
                  id_detalle_receta: "asc",
                },
              },
            },
          },
        },
      },
      costo_indirecto: {
        orderBy: {
          fecha_registro: "desc",
        },
      },
      margen_ganancia: {
        orderBy: {
          fecha_aplicacion: "desc",
        },
      },
      rentabilidad: {
        orderBy: {
          fecha_calculo: "desc",
        },
      },
    },
  });

  if (!costing) {
    notFound();
  }

  const workOrder = costing.orden_trabajo;

  const materialRows =
    workOrder?.version_receta?.detalle_receta.map((detail) => {
      const quantityToProduce = toNumber(workOrder.cantidad);
      const quantityPerUnit = toNumber(detail.cantidad_requerida);
      const wastePercentage = toNumber(detail.merma_estimada_porcentaje);
      const unitCost = toNumber(detail.material.costo_unitario_actual);

      const requiredBase = quantityPerUnit * quantityToProduce;
      const requiredWithWaste = requiredBase * (1 + wastePercentage / 100);
      const estimatedCost = requiredWithWaste * unitCost;

      return {
        id: detail.id_detalle_receta,
        materialName: detail.material.nombre_material,
        category: detail.material.categoria,
        consumptionType: detail.tipo_consumo,
        unit: detail.unidad_medida,
        quantityPerUnit,
        requiredBase,
        wastePercentage,
        requiredWithWaste,
        unitCost,
        estimatedCost,
      };
    }) ?? [];

  const latestMargin = costing.margen_ganancia[0];
  const latestProfitability = costing.rentabilidad[0];

  const profitabilityReference = latestMargin
    ? getProfitabilityReference(
        costing.costo_total,
        latestMargin.precio_final ?? latestMargin.precio_sugerido,
        latestMargin.porcentaje_margen,
      )
    : null;

  const sourceLabel = workOrder
    ? `${workOrder.id_orden_trabajo} · ${workOrder.producto.nombre_producto}`
    : costing.pedido
      ? `${costing.pedido.id_pedido} · ${costing.pedido.cliente.nombre_razon_social}`
      : "Costeo manual";

  const clientName =
    workOrder?.detalle_pedido?.pedido.cliente.nombre_razon_social ??
    workOrder?.cliente?.nombre_razon_social ??
    costing.pedido?.cliente.nombre_razon_social ??
    null;

  return (
    <main className="space-y-6">
      <PageHeader
        title={`Costeo ${costing.id_costeo}`}
        description={sourceLabel}
        backHref={navigationHrefs.costs}
        backLabel="Volver a costos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Costos", href: navigationHrefs.costs },
          { label: "Costeos", href: navigationHrefs.costings },
          { label: "Detalle" },
        ])}
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/costs/work-orders">
              Generar otro costeo
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-5">
        <KpiCard title="Costo materiales" value={formatMoney(costing.costo_materiales)} description="Materia prima." tone="info" />
        <KpiCard title="Costo consumibles" value={formatMoney(costing.costo_consumibles)} description="Insumos secundarios." tone="info" />
        <KpiCard title="Mano de obra" value={formatMoney(costing.costo_mano_obra)} description="Estimada u operativa." tone="info" />
        <KpiCard title="Costo indirecto total" value={formatMoney(costing.costo_indirecto_total)} description="Gastos indirectos." tone="warning" />
        <KpiCard title="Costo total" value={formatMoney(costing.costo_total)} description={`Unitario: ${formatMoney(costing.costo_unitario)}`} tone="warning" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del costeo</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Fecha de costeo</dt>
                <dd className="font-medium">{formatDate(costing.fecha_costeo)}</dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cantidad base</dt>
                <dd className="font-medium">
                  {formatDecimal(costing.cantidad_base)}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Registrado por</dt>
                <dd className="font-medium">
                  {costing.usuario.nombres} {costing.usuario.apellidos}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium">{clientName ?? "-"}</dd>
              </div>
            </dl>

            <div className="mt-5 rounded-lg border border-border/80 bg-secondary/40 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Mano de obra y recálculo
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                La mano de obra inicial se estima desde tareas de operario con
                horas y tarifa registradas. Puedes ajustarla manualmente si
                faltan datos operativos.
              </p>

              <form
                action={updateLaborCostAction}
                className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
              >
                <input type="hidden" name="id_costeo" value={costing.id_costeo} />

                <div className="space-y-2">
                  <Label htmlFor="costo_mano_obra">
                    Costo de mano de obra
                  </Label>
                  <Input
                    id="costo_mano_obra"
                    name="costo_mano_obra"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={formatDecimal(costing.costo_mano_obra)}
                  />
                </div>

                <Button type="submit" className="self-end">
                  Actualizar
                </Button>
              </form>

              <form action={recalculateCostingAction} className="mt-3">
                <input type="hidden" name="id_costeo" value={costing.id_costeo} />

                <Button type="submit" variant="outline">
                  Recalcular costeo
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado económico</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Margen aplicado</dt>
                <dd className="font-medium">
                  {latestMargin
                    ? formatPercent(latestMargin.porcentaje_margen)
                    : "Pendiente"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Precio sugerido</dt>
                <dd className="font-medium">
                  {latestMargin
                    ? formatMoney(latestMargin.precio_sugerido)
                    : "Pendiente"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Precio final</dt>
                <dd className="font-medium">
                  {latestMargin?.precio_final
                    ? formatMoney(latestMargin.precio_final)
                    : "Pendiente"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Utilidad estimada</dt>
                <dd className="font-medium">
                  {latestProfitability
                    ? formatMoney(latestProfitability.utilidad_estimada)
                    : "Pendiente"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Margen real</dt>
                <dd className="font-medium">
                  {latestProfitability
                    ? formatPercent(latestProfitability.margen_real)
                    : "Pendiente"}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Estado</dt>
                <dd className="font-medium">
                  {latestProfitability ? (
                    <Badge
                      variant={
                        latestProfitability.alerta_bajo_margen
                          ? "destructive"
                          : "success"
                      }
                    >
                      {latestProfitability.alerta_bajo_margen
                        ? "Margen bajo"
                        : "Rentable"}
                    </Badge>
                  ) : (
                    "Pendiente"
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      {latestProfitability?.alerta_bajo_margen ? (
        <Alert variant="destructive">
          <AlertDescription>
            <span className="font-medium text-foreground">
              Alerta de bajo margen
            </span>
            <span className="mt-1 block">
              La última rentabilidad calculada está por debajo del margen
              esperado. Revisa costos, precio final o margen aplicado antes de
              cerrar la evaluación comercial.
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desglose referencial</CardTitle>
          <p className="text-sm text-muted-foreground">
            Este detalle muestra cómo se calcula el costo desde la receta
            técnica y el costo unitario actual de cada material.
          </p>
        </CardHeader>

        <CardContent className="px-0">
          {materialRows.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Este costeo no tiene una orden de trabajo con receta técnica asociada."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cant. x unidad</TableHead>
                  <TableHead>Requerido base</TableHead>
                  <TableHead>Merma</TableHead>
                  <TableHead>Requerido total</TableHead>
                  <TableHead>Costo unitario</TableHead>
                  <TableHead>Costo estimado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {materialRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.materialName}</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.category}
                      </p>
                    </TableCell>

                    <TableCell>{getCostTypeLabel(row.consumptionType)}</TableCell>

                    <TableCell>
                      {formatDecimal(row.quantityPerUnit)} {row.unit}
                    </TableCell>

                    <TableCell>
                      {formatDecimal(row.requiredBase)} {row.unit}
                    </TableCell>

                    <TableCell>{formatPercent(row.wastePercentage)}</TableCell>

                    <TableCell>
                      {formatDecimal(row.requiredWithWaste)} {row.unit}
                    </TableCell>

                    <TableCell>{formatMoney(row.unitCost)}</TableCell>

                    <TableCell className="font-medium">
                      {formatMoney(row.estimatedCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Registrar costo indirecto
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Agrega gastos indirectos relacionados con este costeo. El
              sistema recalculará automáticamente el costo indirecto total, el
              costo total y el costo unitario.
            </p>
          </CardHeader>

          <CardContent>
            <form action={createIndirectCostAction} className="space-y-4">
              <input type="hidden" name="id_costeo" value={costing.id_costeo} />

              <div className="space-y-2">
                <Label htmlFor="concepto">Concepto</Label>
                <Input
                  id="concepto"
                  name="concepto"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Ejemplo: Consumo de luz del lote"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <NativeSelect
                    id="categoria"
                    name="categoria"
                    required
                    defaultValue="luz"
                  >
                    <option value="luz">Luz</option>
                    <option value="desgaste_maquinaria">
                      Desgaste de maquinaria
                    </option>
                    <option value="transporte">Transporte</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="alquiler">Alquiler</option>
                    <option value="mano_obra_indirecta">
                      Mano de obra indirecta
                    </option>
                    <option value="otros">Otros</option>
                  </NativeSelect>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monto">Monto</Label>
                  <Input
                    id="monto"
                    name="monto"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="criterio_prorrateo">
                    Criterio de prorrateo
                  </Label>
                  <Input
                    id="criterio_prorrateo"
                    name="criterio_prorrateo"
                    type="text"
                    maxLength={100}
                    placeholder="Ejemplo: Prorrateado por lote"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periodo">Periodo</Label>
                  <Input
                    id="periodo"
                    name="periodo"
                    type="text"
                    maxLength={30}
                    placeholder="Ejemplo: 2026-06"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  name="observaciones"
                  rows={3}
                  placeholder="Detalle adicional del costo indirecto registrado."
                />
              </div>

              <Button type="submit">Registrar costo indirecto</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Costos indirectos registrados
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Historial de gastos indirectos asociados al costeo.
            </p>
          </CardHeader>

          <CardContent className="px-0">
            {costing.costo_indirecto.length === 0 ? (
              <EmptyState
                className="mx-6 border-0"
                label="Todavía no hay costos indirectos registrados para este costeo."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {costing.costo_indirecto.map((item) => (
                    <TableRow key={item.id_costo_indirecto}>
                      <TableCell>{formatShortDate(item.fecha_registro)}</TableCell>

                      <TableCell>
                        <div className="font-medium">{item.concepto}</div>
                        {item.criterio_prorrateo ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.criterio_prorrateo}
                          </p>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        {getIndirectCostCategoryLabel(item.categoria)}
                      </TableCell>

                      <TableCell>{item.periodo ?? "-"}</TableCell>

                      <TableCell className="text-right font-medium">
                        {formatMoney(item.monto)}
                      </TableCell>

                      <TableCell className="text-right">
                        {item.observaciones?.includes("[ANULADO]") ? (
                          <span className="text-xs text-muted-foreground">
                            Anulado
                          </span>
                        ) : (
                          <form action={annulIndirectCostAction}>
                            <input
                              type="hidden"
                              name="id_costo_indirecto"
                              value={item.id_costo_indirecto}
                            />
                            <ConfirmDeleteButton
                              title="¿Anular costo indirecto?"
                              description="Esta acción anulará el costo indirecto y no se puede deshacer."
                              confirmText="Confirmar anulación"
                              entityName="costo indirecto"
                              className="rounded-none border-0 bg-transparent px-0 py-0 hover:bg-transparent"
                            >
                              Anular
                            </ConfirmDeleteButton>
                          </form>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Aplicar margen de ganancia
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Aplica un margen entre 15% y 20% sobre el costo total. El
              sistema calculará automáticamente el precio sugerido y
              permitirá registrar un precio final ajustado.
            </p>
          </CardHeader>

          <CardContent>
            <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
              <p className="font-medium text-foreground">Referencia rápida</p>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Costo total</p>
                  <p className="font-semibold text-foreground">
                    {formatMoney(costing.costo_total)}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">Precio con 15%</p>
                  <p className="font-semibold text-foreground">
                    {formatMoney(getSuggestedPrice(costing.costo_total, 15))}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">Precio con 20%</p>
                  <p className="font-semibold text-foreground">
                    {formatMoney(getSuggestedPrice(costing.costo_total, 20))}
                  </p>
                </div>
              </div>
            </div>

            <form action={createMarginAction} className="mt-5 space-y-4">
              <input type="hidden" name="id_costeo" value={costing.id_costeo} />

              <div className="space-y-2">
                <Label htmlFor="porcentaje_margen">Margen de ganancia</Label>
                <NativeSelect
                  id="porcentaje_margen"
                  name="porcentaje_margen"
                  required
                  defaultValue="15"
                >
                  <option value="15">15%</option>
                  <option value="16">16%</option>
                  <option value="17">17%</option>
                  <option value="18">18%</option>
                  <option value="19">19%</option>
                  <option value="20">20%</option>
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label htmlFor="precio_final">Precio final ajustado</Label>
                <Input
                  id="precio_final"
                  name="precio_final"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Opcional. Si lo dejas vacío, se usará el precio sugerido."
                />
                <p className="text-xs text-muted-foreground">
                  Usa este campo si el administrador decide ajustar
                  manualmente el precio por negociación, redondeo o
                  estrategia comercial.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo_ajuste">Motivo de ajuste</Label>
                <Textarea
                  id="motivo_ajuste"
                  name="motivo_ajuste"
                  rows={3}
                  placeholder="Ejemplo: Se redondea el precio final por negociación con el cliente."
                />
              </div>

              <Button type="submit">Aplicar margen</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Márgenes aplicados</CardTitle>
            <p className="text-sm text-muted-foreground">
              Historial de márgenes registrados para este costeo.
            </p>
          </CardHeader>

          <CardContent className="px-0">
            {costing.margen_ganancia.length === 0 ? (
              <EmptyState
                className="mx-6 border-0"
                label="Todavía no hay márgenes aplicados para este costeo."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Margen</TableHead>
                    <TableHead>Precio sugerido</TableHead>
                    <TableHead>Precio final</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {costing.margen_ganancia.map((item) => (
                    <TableRow key={item.id_margen}>
                      <TableCell>{formatShortDate(item.fecha_aplicacion)}</TableCell>
                      <TableCell>{formatPercent(item.porcentaje_margen)}</TableCell>
                      <TableCell>{formatMoney(item.precio_sugerido)}</TableCell>
                      <TableCell>
                        {item.precio_final ? formatMoney(item.precio_final) : "-"}
                      </TableCell>
                      <TableCell>{item.motivo_ajuste ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calcular rentabilidad</CardTitle>
            <p className="text-sm text-muted-foreground">
              Calcula la utilidad estimada comparando el ingreso esperado
              contra el costo total del costeo.
            </p>
          </CardHeader>

          <CardContent>
            {!latestMargin ? (
              <Alert variant="warning">
                <AlertDescription>
                  Primero debes aplicar un margen de ganancia para obtener un
                  precio sugerido o precio final.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
                  <p className="font-medium text-foreground">
                    Vista previa de rentabilidad
                  </p>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Ingreso estimado</p>
                      <p className="font-semibold text-foreground">
                        {formatMoney(profitabilityReference?.income)}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Costo total</p>
                      <p className="font-semibold text-foreground">
                        {formatMoney(costing.costo_total)}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Utilidad estimada</p>
                      <p className="font-semibold text-foreground">
                        {formatMoney(profitabilityReference?.profit)}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Margen real</p>
                      <p className="font-semibold text-foreground">
                        {formatPercent(profitabilityReference?.realMargin)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Badge
                      variant={
                        profitabilityReference?.lowMarginAlert
                          ? "destructive"
                          : "success"
                      }
                    >
                      {profitabilityReference?.lowMarginAlert
                        ? "Margen bajo"
                        : "Rentable"}
                    </Badge>
                  </div>
                </div>

                <form
                  action={createProfitabilityAction}
                  className="mt-5 space-y-4"
                >
                  <input
                    type="hidden"
                    name="id_costeo"
                    value={costing.id_costeo}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="observaciones_rentabilidad">
                      Observaciones
                    </Label>
                    <Textarea
                      id="observaciones_rentabilidad"
                      name="observaciones"
                      rows={3}
                      placeholder="Ejemplo: Rentabilidad aceptable según margen comercial aplicado."
                    />
                  </div>

                  <Button type="submit">Calcular rentabilidad</Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Historial de rentabilidad
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Últimos cálculos de utilidad y margen real asociados al costeo.
            </p>
          </CardHeader>

          <CardContent className="px-0">
            {costing.rentabilidad.length === 0 ? (
              <EmptyState
                className="mx-6 border-0"
                label="Todavía no hay cálculos de rentabilidad registrados para este costeo."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Ingreso</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Utilidad</TableHead>
                    <TableHead>Margen real</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {costing.rentabilidad.map((item) => (
                    <TableRow key={item.id_rentabilidad}>
                      <TableCell>{formatShortDate(item.fecha_calculo)}</TableCell>
                      <TableCell>{formatMoney(item.ingreso_estimado)}</TableCell>
                      <TableCell>{formatMoney(item.costo_total)}</TableCell>
                      <TableCell>{formatMoney(item.utilidad_estimada)}</TableCell>
                      <TableCell>{formatPercent(item.margen_real)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.alerta_bajo_margen ? "destructive" : "success"
                          }
                        >
                          {item.alerta_bajo_margen ? "Margen bajo" : "Rentable"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
