type StatusBadgeProps = {
  status: string | null | undefined;
};

const statusStyles: Record<string, string> = {
  registrado: "bg-blue-100 text-blue-700",
  aprobado: "bg-indigo-100 text-indigo-700",
  vigente: "bg-blue-100 text-blue-700",
  aceptada: "bg-indigo-100 text-indigo-700",
  pagada: "bg-green-100 text-green-700",
  emitido: "bg-green-100 text-green-700",
  entregado: "bg-green-100 text-green-700",
  pendiente: "bg-yellow-100 text-yellow-700",
  parcial: "bg-yellow-100 text-yellow-700",
  anulada: "bg-red-100 text-red-700",
  anulado: "bg-red-100 text-red-700",
  cancelado: "bg-red-100 text-red-700",
  "sin-proforma": "bg-yellow-100 text-yellow-700",
  "sin-comprobante": "bg-yellow-100 text-yellow-700",
  "en-produccion": "bg-purple-100 text-purple-700",
};

const statusLabels: Record<string, string> = {
  registrado: "Registrado",
  aprobado: "Aprobado",
  vigente: "Vigente",
  aceptada: "Aceptada",
  pagada: "Pagada",
  emitido: "Emitido",
  entregado: "Entregado",
  pendiente: "Pendiente",
  parcial: "Parcial",
  anulada: "Anulada",
  anulado: "Anulado",
  cancelado: "Cancelado",
  "sin-proforma": "Sin proforma",
  "sin-comprobante": "Sin comprobante",
  "en-produccion": "En producción",
};

function normalizeStatus(status: string | null | undefined) {
  return status
    ?.toLowerCase()
    .trim()
    .replaceAll(" ", "-")
    .replaceAll("_", "-");
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const style =
    normalizedStatus && statusStyles[normalizedStatus]
      ? statusStyles[normalizedStatus]
      : "bg-muted text-muted-foreground";

  const label =
    normalizedStatus && statusLabels[normalizedStatus]
      ? statusLabels[normalizedStatus]
      : status ?? "-";

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}