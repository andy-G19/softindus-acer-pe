type StatusBadgeProps = {
  status: string | null | undefined;
};

const statusStyles: Record<string, string> = {
  registrado: "border-blue-300/30 bg-blue-400/10 text-blue-200",
  aprobado: "border-blue-300/30 bg-blue-400/10 text-blue-200",
  vigente: "border-blue-300/30 bg-blue-400/10 text-blue-200",
  aceptada: "border-blue-300/30 bg-blue-400/10 text-blue-200",
  pagada: "border-green-300/30 bg-green-400/10 text-green-200",
  emitido: "border-green-300/30 bg-green-400/10 text-green-200",
  entregado: "border-green-300/30 bg-green-400/10 text-green-200",
  pendiente: "border-primary/35 bg-primary/10 text-primary",
  parcial: "border-primary/35 bg-primary/10 text-primary",
  anulada: "border-red-300/30 bg-red-400/10 text-red-200",
  anulado: "border-red-300/30 bg-red-400/10 text-red-200",
  cancelado: "border-red-300/30 bg-red-400/10 text-red-200",
  "sin-proforma": "border-primary/35 bg-primary/10 text-primary",
  "sin-comprobante": "border-primary/35 bg-primary/10 text-primary",
  "en-produccion": "border-primary/35 bg-primary/10 text-primary",
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
      className={`rounded-full border px-2 py-1 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
