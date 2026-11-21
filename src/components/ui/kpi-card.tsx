/**
 * Indicador (KPI). Desde el diseno de la presentacion (propuesta del responsable, 2026-11-20;
 * D157) es una placa con rejilla de puntos, una franja LED arriba y un halo del color de su tono,
 * y el resplandor que sigue el puntero (PointerSpotlight). Los estilos viven en patterns.css
 * (.kpi-*), leen el tono de --kpi-tone y reemplazan el cepillado de Card.
 *
 * Ademas de titulo, valor, descripcion, tono, icono y enlace, admite los datos de la propuesta,
 * todos opcionales: periodo (pildora), historial (minigrafico de barras), estado y variacion
 * (pie) y un dial de segmentos en lugar del valor. Hoy solo la galeria los llena; son la guia
 * para cuando las consultas los calculen. En reposo nada se mueve (D153): sin contador, sin
 * pulso de alerta y sin punto que respira.
 *
 * Sigue siendo un componente de servidor: icon es una funcion y no puede pasar a uno de
 * cliente; solo el resplandor lleva JavaScript. Con enlace, toda la placa es el enlace y el pie
 * dice «Abrir →» como texto, sin un enlace dentro de otro.
 */
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PointerSpotlight } from "@/components/ui/pointer-spotlight";
import { cn } from "@/lib/utils";

type KpiTone = "success" | "warning" | "info";

export type KpiHistoryPoint = {
  /** Etiqueta del punto: «Día 1», «Sem 3», «Hoy». */
  label: string;
  value: number;
  /** Valor como se lee (con moneda o unidad); si falta, el numero tal cual. */
  valueText?: string;
  /** Dibuja una linea antes de la barra, para separar periodos. */
  separatorBefore?: boolean;
};

export type KpiGauge = {
  current: number;
  total: number;
  /** Segmentos del dial; 16 por defecto, como la propuesta. */
  segments?: number;
};

type KpiCardBaseProps = {
  title: string;
  description: string;
  href?: string;
  tone?: KpiTone;
  icon?: LucideIcon;
  /** Pildora de la cabecera: «6D», «MES». */
  period?: string;
  history?: KpiHistoryPoint[];
  /** Que muestra el minigrafico, para quien no lo ve: «Pedidos de los últimos 6 días». */
  historyLabel?: string;
  /** Texto del pie, con un punto del tono: «Despacho activo». */
  status?: string;
  /** Variacion del pie: «+2 vs ayer»; positive la pinta en verde. */
  delta?: { text: string; positive?: boolean };
};

type KpiCardProps = KpiCardBaseProps &
  ({ value: string; gauge?: undefined } | { value?: undefined; gauge: KpiGauge });

const kpiToneVariables = {
  success: "var(--success)",
  warning: "var(--warning)",
  info: "var(--info)",
} satisfies Record<KpiTone, string>;

// Altura de cada barra entre el 25 % (el minimo) y el 100 % (el maximo), como la propuesta. Si
// todos los valores son iguales, todas llenas: no hay minimo que marcar.
function barHeights(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);

  return values.map((value) => (max === min ? 100 : Math.round(25 + ((value - min) / (max - min)) * 75)));
}

function gaugePercent({ current, total }: KpiGauge) {
  return total > 0 ? Math.round((current / total) * 100) : 0;
}

// Segmentos del dial en un semicirculo, de 180 grados (izquierda) a 0 (derecha), entre los radios
// 64 y 82 alrededor de (112, 104) en un lienzo de 224 x 118. Se encienden desde la izquierda.
function gaugeTicks(percent: number, segments: number) {
  const lit = Math.round(segments * (percent / 100));

  return Array.from({ length: segments }, (_, index) => {
    const radians = ((180 - index * (180 / (segments - 1))) * Math.PI) / 180;
    const point = (radius: number) => ({
      x: (112 + radius * Math.cos(radians)).toFixed(2),
      y: (104 - radius * Math.sin(radians)).toFixed(2),
    });

    return { inner: point(64), outer: point(82), lit: index < lit };
  });
}

function KpiHistory({ history, label }: { history: KpiHistoryPoint[]; label?: string }) {
  const heights = barHeights(history.map((point) => point.value));
  const read = (point: KpiHistoryPoint) => point.valueText ?? String(point.value);
  const summary = history.map((point) => `${point.label} ${read(point)}`).join(", ");

  return (
    <div
      data-slot="kpi-bars"
      role="img"
      aria-label={label ? `${label}: ${summary}` : summary}
      className="kpi-bars"
    >
      {history.map((point, index) => (
        <KpiBar
          key={`${point.label}-${index}`}
          point={point}
          height={heights[index]}
          current={index === history.length - 1}
          text={read(point)}
        />
      ))}
    </div>
  );
}

function KpiBar({
  point,
  height,
  current,
  text,
}: {
  point: KpiHistoryPoint;
  height: number;
  current: boolean;
  text: string;
}) {
  return (
    <>
      {point.separatorBefore ? <span data-slot="kpi-bar-separator" className="kpi-bar-separator" /> : null}
      <span
        data-slot="kpi-bar"
        data-current={current ? "true" : undefined}
        data-tooltip={`${point.label}: ${text}`}
        className="kpi-bar"
        style={{ height: `${height}%` }}
      />
    </>
  );
}

function KpiGaugeDial({ gauge, description }: { gauge: KpiGauge; description: string }) {
  const percent = gaugePercent(gauge);

  return (
    <div data-slot="kpi-gauge" className="kpi-gauge">
      <div className="kpi-gauge-stage">
        <svg viewBox="0 0 224 118" aria-hidden="true">
          {gaugeTicks(percent, gauge.segments ?? 16).map((tick, index) => (
            <line
              key={index}
              className="kpi-gauge-tick"
              data-lit={tick.lit ? "true" : undefined}
              x1={tick.inner.x}
              y1={tick.inner.y}
              x2={tick.outer.x}
              y2={tick.outer.y}
            />
          ))}
        </svg>
        <div data-slot="kpi-gauge-value" className="kpi-gauge-value">
          {percent}
          <span className="kpi-gauge-unit">%</span>
        </div>
      </div>
      <p className="kpi-caption">{description}</p>
    </div>
  );
}

export function KpiCard({
  title,
  value,
  description,
  href,
  tone = "info",
  icon: Icon,
  period,
  history,
  historyLabel,
  status,
  delta,
  gauge,
}: KpiCardProps) {
  const hasFooter = Boolean(status || delta || href);

  const content = (
    <Card
      data-tone={tone}
      style={{ "--kpi-tone": kpiToneVariables[tone] } as CSSProperties & Record<"--kpi-tone", string>}
      className={cn("kpi-card h-full gap-0 py-0", !href && "spotlight-host")}
    >
      <span data-slot="kpi-led" aria-hidden="true" className="kpi-led" />
      <span data-slot="kpi-halo" aria-hidden="true" className="kpi-halo" />
      <PointerSpotlight />

      <div className="relative z-[1] flex h-full flex-col gap-2.5 px-[18px] pt-[18px] pb-3.5">
        <div className="kpi-head" data-align={gauge ? "center" : undefined}>
          <span data-slot="kpi-label" className="kpi-label">
            {title}
          </span>
          {period || Icon ? (
            <span className="flex items-center gap-2">
              {period ? (
                <span data-slot="kpi-period" className="kpi-period">
                  {period}
                </span>
              ) : null}
              {Icon ? (
                <span data-slot="kpi-icon" aria-hidden="true" className="kpi-icon">
                  <Icon />
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        {gauge ? (
          <KpiGaugeDial gauge={gauge} description={description} />
        ) : (
          <div className="kpi-body">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p data-slot="kpi-value" className="kpi-value">
                {value}
              </p>
              <p className="kpi-caption">{description}</p>
            </div>
            {history && history.length > 0 ? <KpiHistory history={history} label={historyLabel} /> : null}
          </div>
        )}

        {hasFooter ? (
          <div data-slot="kpi-footer" className="kpi-footer">
            <span className="kpi-status">
              {status ? (
                <>
                  <span data-slot="kpi-status-dot" aria-hidden="true" className="kpi-status-dot" />
                  {status}
                </>
              ) : null}
            </span>
            {delta ? (
              <span data-slot="kpi-delta" data-positive={delta.positive ? "true" : undefined} className="kpi-delta">
                {delta.text}
              </span>
            ) : null}
            {href ? (
              <span data-slot="kpi-open" className="kpi-open">
                Abrir →
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="spotlight-host block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
    >
      {content}
    </Link>
  );
}
