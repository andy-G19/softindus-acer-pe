import { formatCents, toCents } from "@/lib/decimal-cents";
import { toNumber } from "@/lib/numbers";
import { calculatePurchaseBalance, type AmountValue } from "@/lib/supplier-payment-amounts";

/**
 * Totales de caja chica y de compras por pagar del reporte financiero (C7 de la 11.4b, D52).
 *
 * La pagina y la exportacion los sumaban sobre las filas que cargaban (como maximo 100 en la
 * pagina y el limite en la exportacion), asi que con mas filas quedaban cortos. Ahora parten de
 * las sumas de todos los movimientos del filtro (aggregate) y de todas las compras pendientes, y
 * las dos usan esta funcion. Sin Prisma ni `server-only`: la llaman la pagina y el exportador.
 */

type AmountSum = { _sum: { monto: AmountValue | null } };

export type PendingPurchaseAmounts = {
  monto_total: AmountValue;
  pago_proveedor: { monto_pagado: AmountValue }[];
}[];

export function summarizeFinancialTotals({
  cashIncomeSum,
  cashExpenseSum,
  pendingPurchaseAmounts,
}: {
  cashIncomeSum: AmountSum;
  cashExpenseSum: AmountSum;
  pendingPurchaseAmounts: PendingPurchaseAmounts;
}) {
  const totalCashIncome = toNumber(cashIncomeSum._sum.monto);
  const totalCashExpense = toNumber(cashExpenseSum._sum.monto);

  // El saldo de cada compra en centesimos, como el pago a proveedor (11.2a); una compra con mas
  // pagado que su total no resta.
  const pendingCents = pendingPurchaseAmounts.reduce<bigint>((sum, purchase) => {
    const { balance } = calculatePurchaseBalance(
      purchase.monto_total,
      purchase.pago_proveedor.map((payment) => payment.monto_pagado),
    );
    const balanceCents = toCents(balance) ?? 0n;

    return balanceCents > 0n ? sum + balanceCents : sum;
  }, 0n);

  return {
    totalCashIncome,
    totalCashExpense,
    cashNetMovement: totalCashIncome - totalCashExpense,
    pendingPurchasesBalance: formatCents(pendingCents),
    pendingPurchasesCount: pendingPurchaseAmounts.length,
  };
}
