type StatusBadgeProps = {
  status: string | null | undefined;
};

const statusStyles: Record<string, string> = {
  registrado: "badge-state-info",
  aprobado: "badge-state-info",
  vigente: "badge-state-info",
  aceptada: "badge-state-info",
  pagada: "badge-state-success",
  emitido: "badge-state-success",
  entregado: "badge-state-success",
  pendiente: "badge-state-active",
  parcial: "badge-state-active",
  anulada: "badge-state-danger",
  anulado: "badge-state-danger",
  cancelado: "badge-state-danger",
  "sin-proforma": "badge-state-active",
  "sin-comprobante": "badge-state-active",
  "en-produccion": "badge-state-active",
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
      : "border-border bg-secondary text-muted-foreground";

  const label =
    normalizedStatus && statusLabels[normalizedStatus]
      ? statusLabels[normalizedStatus]
      : status ?? "-";

  return (
    <span
      className={`rounded-full border px-2 py-1 font-mono text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
