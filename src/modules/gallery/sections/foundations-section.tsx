import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

// Tokens de color de src/styles/tokens.css. El nombre de la izquierda es su
// papel en la interfaz; el de la derecha, la variable CSS.
const COLOR_TOKENS = [
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
  { token: "--primary", label: "Primario" },
  { token: "--ring", label: "Foco" },
  { token: "--success", label: "Éxito" },
  { token: "--warning", label: "Advertencia" },
  { token: "--info", label: "Información" },
  { token: "--destructive", label: "Peligro" },
  { token: "--destructive-foreground", label: "Texto sobre peligro" },
  { token: "--accent-forge", label: "Forja (marca)" },
  { token: "--accent-ember", label: "Brasa (marca)" },
  { token: "--accent-steel", label: "Acero (marca)" },
  { token: "--accent-cyan", label: "Limpiar (cian)" },
  { token: "--accent-cyan-foreground", label: "Texto sobre cian" },
  { token: "--sidebar", label: "Barra lateral" },
  { token: "--chart-1", label: "Gráfico 1" },
  { token: "--chart-2", label: "Gráfico 2" },
  { token: "--chart-3", label: "Gráfico 3" },
  { token: "--chart-4", label: "Gráfico 4" },
  { token: "--chart-5", label: "Gráfico 5" },
] as const;

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

const SAMPLE_TEXT = "Industrias Aceros Perú · ¿Año? ¡Sí! Ñandú 0123456789 S/ 1 234,50";

const RADII = ["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl"] as const;

export function FoundationsSection() {
  return (
    <GallerySection
      id="fundamentos"
      description="Tokens de la identidad actual (src/styles/tokens.css): colores, tipografía, radios, sombras, capas y movimiento. Cada componente de la galería se construye con ellos."
    >
      <GallerySample label="Colores" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {COLOR_TOKENS.map(({ token, label }) => (
          <div key={token} className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="size-10 shrink-0 rounded-lg border border-border"
              style={{ background: `var(${token})` }}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{label}</span>
              <span className="block truncate font-mono text-xs text-muted-foreground">{token}</span>
            </span>
          </div>
        ))}
      </GallerySample>

      <GallerySample label="Texto (Geist)" className="flex-col items-start gap-1">
        <p className="font-sans text-base font-normal">{SAMPLE_TEXT}</p>
        <p className="font-sans text-base font-medium">{SAMPLE_TEXT}</p>
        <p className="font-sans text-base font-semibold">{SAMPLE_TEXT}</p>
        <p className="font-sans text-base font-bold">{SAMPLE_TEXT}</p>
      </GallerySample>

      <GallerySample label="Títulos (Oswald 500, 600, 650 y 700)" className="flex-col items-start gap-1">
        <p className="font-heading text-2xl font-medium">{SAMPLE_TEXT}</p>
        <p className="font-heading text-2xl font-semibold">{SAMPLE_TEXT}</p>
        <p className="font-heading text-2xl font-[650]">{SAMPLE_TEXT}</p>
        <p className="font-heading text-2xl font-bold">{SAMPLE_TEXT}</p>
      </GallerySample>
      <GalleryNote>
        Oswald se declara con los pesos 500, 600 y 700: el 650 de los títulos de
        página se resuelve en 700, como cuando la fuente venía de Google.
      </GalleryNote>

      <GallerySample label="Códigos y cifras (JetBrains Mono 500)">
        <p className="font-mono text-sm font-medium">CLI00000001 · OTR00000006 · 1 234,50</p>
      </GallerySample>

      <GallerySample label="Radios">
        {RADII.map((radius) => (
          <span
            key={radius}
            className={`flex h-12 w-24 items-center justify-center border border-border bg-secondary font-mono text-[11px] text-muted-foreground ${radius}`}
          >
            {radius}
          </span>
        ))}
      </GallerySample>

      <GallerySample label="Sombras" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SHADOW_TOKENS.map(({ token, label }) => (
          <div
            key={token}
            className="flex min-h-16 flex-col justify-center rounded-lg border border-border bg-card px-3 py-2"
            style={{ boxShadow: `var(${token})` }}
          >
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="font-mono text-xs text-muted-foreground">{token}</span>
          </div>
        ))}
      </GallerySample>

      <GalleryNote>
        Capas (--z-*): barra lateral 30, cabecera 40 y ventanas 50. Movimiento
        (--motion-*): 150, 200 y 250 ms para transiciones y 6 s para la barra
        térmica, que se detiene con la preferencia de movimiento reducido. El
        espaciado y la escala tipográfica son los de Tailwind.
      </GalleryNote>
    </GallerySection>
  );
}
