import { toNumber } from "@/lib/numbers";

// Cobranza de un pedido en el reporte de Ventas y cobranzas: lo cobrado por
// tipo de pago, el saldo y el estado. La pantalla y la exportacion usan esta
// misma funcion (entrega 11.1): el estado se filtra en memoria, despues de la
// consulta, asi que la prueba de paridad del where no lo ve.

export type CollectionStatus = "sin_proforma" | "sin_pago" | "con_saldo" | "pagado";

type ClientPayment = {
  tipo_pago: string;
  monto_pagado: unknown;
};

// La proforma que cuenta para la cobranza del pedido, o null si no tiene.
type CollectionQuote = {
  adelanto_inicial: unknown;
  saldo: unknown;
  pago_cliente: ClientPayment[];
};

export function getPaymentTotalByType(payments: ClientPayment[], type: string) {
  return payments.reduce((sum, payment) => {
    if (payment.tipo_pago !== type) {
      return sum;
    }

    return sum + toNumber(payment.monto_pagado);
  }, 0);
}

function getCollectionStatus(data: {
  hasQuote: boolean;
  totalPaid: number;
  pendingBalance: number;
}): CollectionStatus {
  if (!data.hasQuote) {
    return "sin_proforma";
  }

  if (data.totalPaid <= 0 && data.pendingBalance > 0) {
    return "sin_pago";
  }

  if (data.pendingBalance > 0) {
    return "con_saldo";
  }

  return "pagado";
}

export function getCollectionSummary(quote: CollectionQuote | null) {
  const payments = quote?.pago_cliente ?? [];

  const initialAdvance = toNumber(quote?.adelanto_inicial);
  const advancePayments = getPaymentTotalByType(payments, "adelanto");
  const amortizationPayments = getPaymentTotalByType(payments, "amortizacion");
  const cancellationPayments = getPaymentTotalByType(payments, "cancelacion");

  // Los pagos de otro tipo no cuentan como cobrados.
  const totalPaid =
    initialAdvance + advancePayments + amortizationPayments + cancellationPayments;

  const pendingBalance = quote ? toNumber(quote.saldo) : 0;

  return {
    initialAdvance,
    advancePayments,
    amortizationPayments,
    cancellationPayments,
    totalPaid,
    pendingBalance,
    collectionStatus: getCollectionStatus({
      hasQuote: Boolean(quote),
      totalPaid,
      pendingBalance,
    }),
  };
}

// Sin estado elegido en el filtro, todos los pedidos pasan. El parametro no se
// llama "filter": Tailwind leeria su negacion como una clase y la agregaria
// al CSS de produccion.
export function matchesCollectionStatus(status: CollectionStatus, selected: string) {
  return selected === "" || status === selected;
}
