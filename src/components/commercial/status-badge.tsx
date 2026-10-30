import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";

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

// Etiqueta de estado con Badge (entrega 10.4b, D6 de la 10.4): las mismas
// etiquetas y los mismos tonos que StatusBadge, con la forma de Badge, mas
// compacta y en mayusculas. Comercial la usa desde la 10.4b; Mantenimiento y
// Mermas ya usaban Badge con sus propias variantes, asi que StatusBadge solo
// queda en la galeria y se retira en la entrega 11 (D8 de la 10.5). Cada
// clase de tono pasa a su variante, como en la galeria; un estado sin tono usa
// outline, la mas parecida al gris de StatusBadge. Solo cuentan los estados de las tablas
// (Object.hasOwn): "constructor" no toma una propiedad de Object.
type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

const variantByStyle: Record<string, BadgeVariant> = {
  "badge-state-info": "info",
  "badge-state-success": "success",
  "badge-state-active": "default",
  "badge-state-danger": "destructive",
};

export function StateBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const style =
    normalizedStatus && Object.hasOwn(statusStyles, normalizedStatus)
      ? statusStyles[normalizedStatus]
      : undefined;
  const label =
    normalizedStatus && Object.hasOwn(statusLabels, normalizedStatus)
      ? statusLabels[normalizedStatus]
      : status ?? "-";

  return <Badge variant={style ? variantByStyle[style] : "outline"}>{label}</Badge>;
}
