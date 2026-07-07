import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createSupplierPaymentAction } from "@/modules/inventory/supplier-payments/actions";

type SupplierPaymentFormProps = {
  idCompra: string;
  saldoPendiente: number;
};

export function SupplierPaymentForm({
  idCompra,
  saldoPendiente,
}: SupplierPaymentFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar pago</CardTitle>
        <p className="text-sm text-muted-foreground">
          Saldo pendiente actual:{" "}
          <span className="font-semibold text-foreground">
            S/ {saldoPendiente.toFixed(2)}
          </span>
        </p>
      </CardHeader>

      <CardContent>
        <form action={createSupplierPaymentAction} className="space-y-5">
          <input type="hidden" name="id_compra" value={idCompra} />

          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Fecha de pago *</Label>
              <Input name="fecha_pago" type="date" required />
            </div>

            <div className="space-y-2">
              <Label>Monto pagado *</Label>
              <Input
                name="monto_pagado"
                type="number"
                step="0.01"
                min="0.01"
                max={saldoPendiente}
                required
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Método de pago *</Label>
              <NativeSelect name="metodo_pago" required>
                <option value="">Seleccione método</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="otro">Otro</option>
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              name="observaciones"
              rows={3}
              placeholder="Notas del pago realizado"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit">Guardar pago</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
