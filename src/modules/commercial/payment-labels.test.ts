import { describe, expect, it } from "vitest";

import {
  getOptionLabel,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  RECEIPT_TYPE_OPTIONS,
} from "@/modules/commercial/payment-labels";
import { paymentSchema } from "@/schemas/commercial/payment.schema";
import { receiptSchema } from "@/schemas/commercial/receipt.schema";

// C1 de la 11.3c (D36): un solo lugar para el texto de cada valor de pago y comprobante.
describe("textos de pago y comprobante de Comercial", () => {
  it("da el texto de cada valor conocido", () => {
    expect(getOptionLabel(PAYMENT_TYPE_OPTIONS, "amortizacion")).toBe("Amortización");
    expect(getOptionLabel(PAYMENT_TYPE_OPTIONS, "cancelacion")).toBe("Cancelación");
    expect(getOptionLabel(PAYMENT_METHOD_OPTIONS, "transferencia")).toBe("Transferencia");
    expect(getOptionLabel(RECEIPT_TYPE_OPTIONS, "factura")).toBe("Factura");
  });

  it("muestra tal cual un valor que no conoce, nunca vacio", () => {
    expect(getOptionLabel(PAYMENT_METHOD_OPTIONS, "deposito")).toBe("deposito");
    expect(getOptionLabel(RECEIPT_TYPE_OPTIONS, "")).toBe("");
  });

  // Las listas ofrecen exactamente lo que aceptan los esquemas: un valor que falte no se podria
  // filtrar y uno de mas filtraria por algo que nadie puede guardar.
  it("ofrecen los mismos valores que aceptan los esquemas", () => {
    const values = (options: readonly (readonly [string, string])[]) =>
      options.map(([value]) => value);

    expect(values(PAYMENT_METHOD_OPTIONS)).toEqual(paymentSchema.shape.metodo_pago.options);
    expect(values(PAYMENT_TYPE_OPTIONS)).toEqual(paymentSchema.shape.tipo_pago.options);
    expect(values(RECEIPT_TYPE_OPTIONS)).toEqual(receiptSchema.shape.tipo_comprobante.options);
  });
});
