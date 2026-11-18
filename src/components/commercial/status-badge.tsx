import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";

type StateBadgeProps = {
  status: string | null | undefined;
};

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

// Variante de Badge de cada estado comercial: info para los vigentes, success para los cerrados
// bien, default (activo) para los que esperan algo y destructive para los anulados. Hasta la 11.7a
// pasaba por la clase de tono de StatusBadge (badge-state-*), que se retiro: la clase la pone ahora
// cada variante de Badge.
const statusVariants: Record<string, BadgeVariant> = {
  registrado: "info",
  aprobado: "info",
  vigente: "info",
  aceptada: "info",
  pagada: "success",
  emitido: "success",
  entregado: "success",
  pendiente: "default",
  parcial: "default",
  anulada: "destructive",
  anulado: "destructive",
  cancelado: "destructive",
  "sin-proforma": "default",
  "sin-comprobante": "default",
  "en-produccion": "default",
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

// Etiqueta de estado con Badge (entrega 10.4b, D6 de la 10.4): Comercial la usa desde la 10.4b;
// Mantenimiento y Mermas usan Badge con sus propias variantes. Un estado sin variante usa outline.
// Solo cuentan los estados de las tablas (Object.hasOwn): "constructor" no toma una propiedad de
// Object. StatusBadge, la etiqueta anterior, se retiro en la 11.7a (D8 de la 10.5).
export function StateBadge({ status }: StateBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const variant =
    normalizedStatus && Object.hasOwn(statusVariants, normalizedStatus)
      ? statusVariants[normalizedStatus]
      : "outline";
  const label =
    normalizedStatus && Object.hasOwn(statusLabels, normalizedStatus)
      ? statusLabels[normalizedStatus]
      : status ?? "-";

  return <Badge variant={variant}>{label}</Badge>;
}
