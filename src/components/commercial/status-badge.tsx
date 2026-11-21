import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StateBadgeProps = {
  status: string | null | undefined;
};

type StateTone = "info" | "success" | "warning" | "destructive" | "neutral";

// Diseno de listados y navegacion (propuesta del responsable, 2026-11-21; D170). La etiqueta de
// estado es simple y documental, como en la maqueta: 22 px de alto, letra de 10,5 px, 9 px a los
// lados y un punto de 5,5 px del color del texto, sin brillo. Cada estado tiene solo un tono: sin
// gestos al montar, sin el radar de «En producción», que pasa a ambar con el punto fijo, y sin el
// relleno a medias de parcial (reemplaza esa parte de D155; ninguna etiqueta tiene ya un bucle,
// D153). Los estados que la propuesta no dibuja siguen a su familia: emitido como pagada, anulada
// y cancelado como anulado, aprobado y aceptada como registrado, y «Sin proforma» y «Sin
// comprobante» como pendiente, porque son un paso que falta. Hasta la 11.7a pasaba por la clase
// de tono de StatusBadge (badge-state-*), que se retiro.
const stateTones: Record<string, StateTone> = {
  registrado: "info",
  aprobado: "info",
  aceptada: "info",
  vigente: "neutral",
  pagada: "success",
  emitido: "success",
  entregado: "success",
  pendiente: "warning",
  "sin-proforma": "warning",
  "sin-comprobante": "warning",
  parcial: "warning",
  "en-produccion": "warning",
  anulado: "destructive",
  anulada: "destructive",
  cancelado: "destructive",
};

// Las medidas de la maqueta, comunes a todos los estados, el desconocido incluido.
const stateSize = "h-[22px] gap-1.5 px-[9px] text-[10.5px]";

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
  const tone =
    normalizedStatus && Object.hasOwn(stateTones, normalizedStatus)
      ? stateTones[normalizedStatus]
      : undefined;
  const label =
    normalizedStatus && Object.hasOwn(statusLabels, normalizedStatus)
      ? statusLabels[normalizedStatus]
      : status ?? "-";

  if (!tone) {
    return (
      <Badge
        variant="outline"
        gesture="none"
        data-tone="unknown"
        className={cn(stateSize, "border-dashed text-muted-foreground")}
      >
        {label}
      </Badge>
    );
  }

  const { variant, className } = toneVariants[tone];

  return (
    <Badge variant={variant} gesture="none" data-tone={tone} className={cn(stateSize, className)}>
      <span
        data-slot="state-dot"
        aria-hidden="true"
        className="size-[5.5px] shrink-0 rounded-full bg-current"
      />
      {label}
    </Badge>
  );
}
