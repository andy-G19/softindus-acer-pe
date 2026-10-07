import { toNumber } from "@/lib/numbers";

// Formatos del detalle de costeo, compartidos por sus secciones. Un valor ausente
// se muestra como 0.00, como hacia el detalle; formatDecimal de lib/formatters
// muestra "-". Unificarlos cambia lo que se ve: es un fix aparte.

export function formatCostingDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

export function formatCostingPercent(value: unknown) {
  return `${toNumber(value).toFixed(2)}%`;
}
