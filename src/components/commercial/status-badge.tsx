import { Badge, type BadgeGesture } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StateBadgeProps = {
  status: string | null | undefined;
};

type StateTone = "info" | "success" | "warning" | "destructive" | "neutral";

type StateLook = {
  tone: StateTone;
  gesture?: BadgeGesture;
  dot?: "steady" | "live";
  partial?: boolean;
};

// Diseno de la presentacion (propuesta del responsable, 2026-11-20; D155). Cada estado tiene un
// tono, un gesto que ocurre una vez al montar (D153) y un punto de color que deja ver, sin leer,
// que tan avanzado va: registrado se sella, vigente respira quieto, pagada y entregado cierran
// en verde, pendiente y parcial esperan en ambar (parcial con un relleno a medias), en produccion
// emite un doble pulso de radar, el unico movimiento continuo, y anulado entra con un golpe de
// sello. Los estados que la propuesta no dibuja siguen a su familia: emitido como pagada, anulada
// y cancelado como anulado, aprobado y aceptada como registrado, y «Sin proforma» y «Sin
// comprobante» como pendiente, porque son un paso que falta. Hasta la 11.7a pasaba por la clase
// de tono de StatusBadge (badge-state-*), que se retiro.
const stateLooks: Record<string, StateLook> = {
  registrado: { tone: "info", gesture: "settle" },
  aprobado: { tone: "info", gesture: "settle" },
  aceptada: { tone: "info", gesture: "settle" },
  vigente: { tone: "neutral", dot: "steady" },
  pagada: { tone: "success", gesture: "settle" },
  emitido: { tone: "success", gesture: "settle" },
  entregado: { tone: "success", gesture: "pop" },
  pendiente: { tone: "warning" },
  "sin-proforma": { tone: "warning" },
  "sin-comprobante": { tone: "warning" },
  parcial: { tone: "warning", partial: true },
  "en-produccion": { tone: "info", gesture: "none", dot: "live" },
  anulado: { tone: "destructive", gesture: "stamp" },
  anulada: { tone: "destructive", gesture: "stamp" },
  cancelado: { tone: "destructive", gesture: "stamp" },
};

// Neutro y desconocido no tienen variante propia de Badge: parten de outline. Neutro toma la
// superficie y el borde comunes con el texto atenuado; desconocido, el borde discontinuo.
const toneVariants = {
  info: { variant: "info", className: undefined },
  success: { variant: "success", className: undefined },
  warning: { variant: "warning", className: undefined },
  destructive: { variant: "destructive", className: undefined },
  neutral: { variant: "outline", className: "border-border bg-muted text-muted-foreground" },
} as const;

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
// Mantenimiento y Mermas usan Badge con sus propias variantes. Un estado sin tono se muestra tal
// cual, con borde discontinuo y sin punto. Solo cuentan los estados de las tablas (Object.hasOwn):
// "constructor" no toma una propiedad de Object. StatusBadge, la etiqueta anterior, se retiro en
// la 11.7a (D8 de la 10.5).
export function StateBadge({ status }: StateBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const look =
    normalizedStatus && Object.hasOwn(stateLooks, normalizedStatus)
      ? stateLooks[normalizedStatus]
      : undefined;
  const label =
    normalizedStatus && Object.hasOwn(statusLabels, normalizedStatus)
      ? statusLabels[normalizedStatus]
      : status ?? "-";

  if (!look) {
    return (
      <Badge
        variant="outline"
        gesture="none"
        data-tone="unknown"
        className="border-dashed text-muted-foreground"
      >
        {label}
      </Badge>
    );
  }

  const { variant, className } = toneVariants[look.tone];

  return (
    <Badge
      variant={variant}
      gesture={look.gesture ?? "none"}
      data-tone={look.tone}
      className={cn(
        "gap-1.5",
        className,
        look.partial && "state-badge-partial",
        look.dot === "live" && "overflow-visible",
      )}
    >
      <span
        data-slot="state-dot"
        aria-hidden="true"
        className={cn(
          "relative size-1.5 shrink-0 rounded-full bg-current",
          look.dot === "steady" && "state-dot-steady",
          look.dot === "live" && "state-dot-live",
        )}
      />
      {label}
    </Badge>
  );
}
