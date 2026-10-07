import {
  ConfirmDeleteButton,
} from "@/components/notifications/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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
import { formatMoney } from "@/lib/formatters";
import {
  annulIndirectCostAction,
  createIndirectCostAction,
} from "@/modules/costs/indirect-costs/actions";
import type { CostingDetail } from "@/modules/costs/costings/queries";

// Costos indirectos del costeo: registrar uno nuevo y anular los registrados.

function formatShortDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
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

type IndirectCostsSectionProps = {
  costing: Pick<CostingDetail, "id_costeo" | "costo_indirecto">;
};

export function IndirectCostsSection({ costing }: IndirectCostsSectionProps) {
  return (
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
  );
}
