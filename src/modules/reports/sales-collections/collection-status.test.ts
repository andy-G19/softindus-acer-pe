import { describe, expect, it } from "vitest";

import {
  getCollectionSummary,
  getPaymentTotalByType,
  matchesCollectionStatus,
} from "@/modules/reports/sales-collections/collection-status";

// Los montos llegan de Prisma como Decimal; aqui, como el texto que los
// representa.
function quote(data: {
  adelanto_inicial?: string | null;
  saldo: string;
  pagos?: [string, string][];
}) {
  return {
    adelanto_inicial: data.adelanto_inicial ?? null,
    saldo: data.saldo,
    pago_cliente: (data.pagos ?? []).map(([tipo_pago, monto_pagado]) => ({
      tipo_pago,
      monto_pagado,
    })),
  };
}

describe("getPaymentTotalByType", () => {
  it("suma solo los pagos del tipo pedido", () => {
    const payments = [
      { tipo_pago: "adelanto", monto_pagado: "100.50" },
      { tipo_pago: "amortizacion", monto_pagado: "40" },
      { tipo_pago: "adelanto", monto_pagado: "20" },
    ];

    expect(getPaymentTotalByType(payments, "adelanto")).toBe(120.5);
    expect(getPaymentTotalByType(payments, "cancelacion")).toBe(0);
  });
});

describe("getCollectionSummary", () => {
  it("un pedido sin proforma no tiene nada cobrado ni saldo", () => {
    expect(getCollectionSummary(null)).toEqual({
      initialAdvance: 0,
      advancePayments: 0,
      amortizationPayments: 0,
      cancellationPayments: 0,
      totalPaid: 0,
      pendingBalance: 0,
      collectionStatus: "sin_proforma",
    });
  });

  it("con saldo y nada cobrado esta sin pago", () => {
    expect(getCollectionSummary(quote({ saldo: "500" })).collectionStatus).toBe("sin_pago");
  });

  it("el adelanto inicial cuenta como cobrado", () => {
    const summary = getCollectionSummary(
      quote({ adelanto_inicial: "200", saldo: "300" }),
    );

    expect(summary.totalPaid).toBe(200);
    expect(summary.collectionStatus).toBe("con_saldo");
  });

  it("suma cada tipo de pago y deja fuera los de otro tipo", () => {
    const summary = getCollectionSummary(
      quote({
        adelanto_inicial: "100",
        saldo: "50",
        pagos: [
          ["adelanto", "10"],
          ["amortizacion", "20"],
          ["cancelacion", "30"],
          ["otro", "1000"],
        ],
      }),
    );

    expect(summary).toEqual({
      initialAdvance: 100,
      advancePayments: 10,
      amortizationPayments: 20,
      cancellationPayments: 30,
      totalPaid: 160,
      pendingBalance: 50,
      collectionStatus: "con_saldo",
    });
  });

  it("sin saldo esta pagado, aunque no tenga pagos registrados", () => {
    expect(getCollectionSummary(quote({ saldo: "0" })).collectionStatus).toBe("pagado");
    expect(
      getCollectionSummary(quote({ saldo: "0", pagos: [["cancelacion", "800"]] }))
        .collectionStatus,
    ).toBe("pagado");
  });
});

describe("matchesCollectionStatus", () => {
  it("sin estado elegido pasa todo; con estado, solo el mismo", () => {
    expect(matchesCollectionStatus("sin_pago", "")).toBe(true);
    expect(matchesCollectionStatus("sin_pago", "sin_pago")).toBe(true);
    expect(matchesCollectionStatus("pagado", "sin_pago")).toBe(false);
  });
});
