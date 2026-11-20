import type { ReactNode } from "react";

import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

// Fundamentos con la propuesta del responsable (2026-11-20). Cada muestra lee el token real de
// src/styles/tokens.css con var(): la galeria ensena lo que usa el ERP, no valores copiados. El
// nombre de la izquierda es el papel en la interfaz; el de la derecha, la variable CSS.
const COLOR_GROUPS = [
  {
    label: "Acción y estado",
    columns: "sm:grid-cols-4",
    tokens: [
      { token: "--primary", label: "Primario" },
      { token: "--ring", label: "Foco" },
      { token: "--success", label: "Éxito" },
      { token: "--warning", label: "Advertencia" },
      { token: "--info", label: "Información" },
      { token: "--destructive", label: "Peligro" },
      { token: "--destructive-foreground", label: "Texto sobre peligro" },
    ],
    note: "Advertencia usa la brasa (--accent-ember), no el naranja de Primario: un aviso de stock bajo no se confunde con el botón «Guardar».",
  },
  {
    label: "Marca",
    columns: "sm:grid-cols-4",
    tokens: [
      { token: "--accent-forge", label: "Forja" },
      { token: "--accent-ember", label: "Brasa" },
      { token: "--accent-steel", label: "Acero" },
      { token: "--accent-copper", label: "Cobre (limpiar)" },
      { token: "--clear-foreground", label: "Texto sobre cobre" },
    ],
  },
  {
    label: "Superficies y neutros",
    columns: "sm:grid-cols-4",
    tokens: [
      { token: "--background", label: "Fondo" },
      { token: "--shell", label: "Fondo del panel" },
      { token: "--foreground", label: "Texto" },
      { token: "--card", label: "Superficie" },
      { token: "--popover", label: "Superficie elevada" },
      { token: "--secondary", label: "Secundario" },
      { token: "--muted", label: "Atenuado" },
      { token: "--muted-foreground", label: "Texto atenuado" },
      { token: "--accent", label: "Acento" },
      { token: "--border", label: "Borde" },
      { token: "--input", label: "Campo" },
      { token: "--sidebar", label: "Barra lateral" },
    ],
    note: "Los grises marcan escalones de elevación (fondo, panel, superficie, superficie elevada). En un chip aislado se parecen; uno sobre otro, como en Ventanas o en Mensajes y estados, se nota el paso.",
  },
  {
    label: "Gráficos",
    columns: "sm:grid-cols-5",
    tokens: [
      { token: "--chart-1", label: "Gráfico 1" },
      { token: "--chart-2", label: "Gráfico 2" },
      { token: "--chart-3", label: "Gráfico 3" },
      { token: "--chart-4", label: "Gráfico 4" },
      { token: "--chart-5", label: "Gráfico 5" },
    ],
    note: "Gráfico 4 es el cobre (--accent-copper): era la brasa, y junto al naranja de Gráfico 1 dos series se confundían.",
  },
] as const;

const SAMPLE_TEXT = "Industrias Aceros Perú · ¿Año? ¡Sí! Ñandú 0123456789 S/ 1 234,50";

const GEIST_SIZES = [
  { size: "13px", className: "text-[0.8125rem] font-normal" },
  { size: "14px", className: "text-sm font-normal" },
  { size: "16px", className: "text-base font-medium" },
  { size: "18px", className: "text-lg font-semibold" },
] as const;

const OSWALD_WEIGHTS = [
  { weight: "500", className: "text-xl font-medium" },
  { weight: "600", className: "text-[1.375rem] font-semibold" },
  { weight: "700", className: "text-[1.5625rem] font-bold" },
] as const;

const RADII = ["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl"] as const;

const SHADOW_TOKENS = [
  { token: "--shadow-raised", label: "Tarjeta" },
  { token: "--shadow-raised-hover", label: "Indicador al pasar" },
  { token: "--shadow-card-hover", label: "Módulo al pasar" },
  { token: "--shadow-panel", label: "Panel de error" },
  { token: "--shadow-menu", label: "Lista desplegable" },
  { token: "--shadow-sidebar", label: "Barra lateral abierta" },
  { token: "--shadow-toast", label: "Aviso" },
  { token: "--shadow-dialog", label: "Confirmación" },
  { token: "--shadow-hairline", label: "Contorno fino" },
] as const;

// El valor repite el de tokens.css; la prueba de la seccion lo compara con el archivo.
const LAYERS = [
  { token: "--z-sidebar", label: "Barra lateral", value: "30" },
  { token: "--z-header", label: "Cabecera", value: "40" },
  { token: "--z-overlay", label: "Ventanas", value: "50" },
] as const;

function FoundationFamily({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="space-y-5 border-t border-border pt-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="max-w-[680px] text-[0.8125rem] leading-[18px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function FoundationNote({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-[17px] text-muted-foreground">{children}</p>;
}

export function FoundationsSection() {
  return (
    <GallerySection
      id="fundamentos"
      description="Tokens de la identidad actual (src/styles/tokens.css): colores, tipografía, radios, sombras, capas y movimiento. Cada componente de la galería se construye con ellos."
    >
      <FoundationFamily title="Colores" description="Un color por significado. Donde dos significados compartían el mismo matiz, se separan.">
        {COLOR_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2.5">
            <GallerySample label={group.label} className={`grid grid-cols-2 items-start gap-5 ${group.columns}`}>
              {group.tokens.map(({ token, label }) => (
                <div key={token} className="flex min-w-0 flex-col gap-[7px]">
                  <span
                    aria-hidden="true"
                    data-token={token}
                    className="block h-[52px] rounded-md border border-control-border"
                    style={{ background: `var(${token})` }}
                  />
                  <span className="truncate text-[0.8125rem] font-semibold text-foreground">{label}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{token}</span>
                </div>
              ))}
            </GallerySample>
            {"note" in group ? <FoundationNote>{group.note}</FoundationNote> : null}
          </div>
        ))}
      </FoundationFamily>

      <FoundationFamily title="Tipografía" description="Geist para texto, Oswald para títulos, JetBrains Mono para códigos y cifras.">
        {/* flex-nowrap: con el flex-wrap de GallerySample cada fila media lo que su texto y el
            truncate no recortaba (en movil la pagina se desbordaba). */}
        <GallerySample label="Texto (Geist)" className="flex-col flex-nowrap items-stretch gap-2.5">
          {GEIST_SIZES.map(({ size, className }) => (
            <div key={size} className="flex min-w-0 items-baseline gap-3">
              <span className="w-11 shrink-0 font-mono text-[11px] text-muted-foreground">{size}</span>
              <span className={`truncate font-sans text-foreground ${className}`}>{SAMPLE_TEXT}</span>
            </div>
          ))}
        </GallerySample>

        <div className="space-y-2.5">
          <GallerySample label="Títulos (Oswald 500, 600 y 700)" className="flex-col flex-nowrap items-stretch gap-2.5">
            {OSWALD_WEIGHTS.map(({ weight, className }) => (
              <div key={weight} className="flex min-w-0 items-baseline gap-3">
                <span className="w-11 shrink-0 font-mono text-[11px] text-muted-foreground">{weight}</span>
                <span className={`truncate font-heading tracking-[-0.01em] text-foreground ${className}`}>{SAMPLE_TEXT}</span>
              </div>
            ))}
          </GallerySample>
          <FoundationNote>
            Oswald se declara con los pesos 500, 600 y 700. Un peso intermedio se dibuja como el
            siguiente declarado, así que los títulos piden 700, el peso que de verdad se ve.
          </FoundationNote>
        </div>

        <GallerySample label="Códigos y cifras (JetBrains Mono 500)">
          <p className="font-mono text-sm font-medium text-foreground">CLI00000001 · OTR00000006 · 1 234,50</p>
        </GallerySample>
      </FoundationFamily>

      <FoundationFamily title="Radios" description="La escala de Tailwind sobre --radius (10 px): de sm a 2xl.">
        <GallerySample label="Radios">
          {RADII.map((radius) => (
            <span
              key={radius}
              className={`inline-flex h-9 items-center justify-center border border-control-border bg-card px-3.5 font-mono text-[11px] text-muted-foreground ${radius}`}
            >
              {radius}
            </span>
          ))}
        </GallerySample>
      </FoundationFamily>

      <FoundationFamily title="Sombras" description="Nueve sombras con nombre de uso, no de tamaño.">
        <GallerySample label="Sombras" className="grid grid-cols-1 gap-5 px-[18px] pt-1 pb-[22px] sm:grid-cols-3">
          {SHADOW_TOKENS.map(({ token, label }) => (
            <div
              key={token}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-[18px]"
              style={{ boxShadow: `var(${token})` }}
            >
              <span className="text-[0.8125rem] font-semibold text-foreground">{label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{token}</span>
            </div>
          ))}
        </GallerySample>
      </FoundationFamily>

      <FoundationFamily title="Capas y movimiento" description="El orden en que se apilan los paneles, y cuánto tardan en moverse.">
        <div className="space-y-2.5">
          <GallerySample label="Capas (--z-*)" className="gap-2.5">
            {LAYERS.map(({ token, label, value }, index) => (
              <div key={token} className="flex items-center gap-2.5">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-[0.8125rem] text-muted-foreground">
                    →
                  </span>
                ) : null}
                <div data-layer={token} className="flex items-center gap-2 rounded-md border border-control-border bg-card px-3 py-2">
                  <span className="text-[0.78125rem] font-medium text-foreground">{label}</span>
                  <span className="font-mono text-[11px] text-accent-ember">{value}</span>
                </div>
              </div>
            ))}
          </GallerySample>
          <FoundationNote>
            Ventanas y paneles laterales se abren en un portal con su propia capa, no en un dialog
            nativo: el 50 está en uso.
          </FoundationNote>
        </div>

        <div className="space-y-2.5">
          <GallerySample label="Barra térmica (.heat-bar)" className="flex-col items-stretch">
            <div aria-hidden="true" className="heat-bar w-full max-w-[420px]" />
          </GallerySample>
          <GallerySample label="Barrido térmico (.heat-sweep), para integrar más adelante" className="flex-col items-stretch">
            <div aria-hidden="true" className="heat-sweep w-full max-w-[420px]" />
          </GallerySample>
          <FoundationNote>
            150, 200 y 250 ms (--motion-fast, --motion-base y --motion-slow) para las transiciones
            comunes, y 6 s (--motion-temper) para las dos barras, que se detienen con movimiento
            reducido. El espaciado y la escala tipográfica son los de Tailwind.
          </FoundationNote>
        </div>
      </FoundationFamily>
    </GallerySection>
  );
}
