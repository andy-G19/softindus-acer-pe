import type { ReactNode } from "react";
import Image from "next/image";
import { AlertTriangle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title: string;
  description?: string;
  detail?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
};

/**
 * Pantalla de error (propuesta de mensajes y estados, 2026-11-19, D137). La escena es la
 * imagen quieta del robot que suelda el monitor, con capas animadas en bucle encima: barrido
 * y caida de brillo en la pantalla, resplandor, chispa y chispas sueltas en la antorcha, humo,
 * el triangulo de alerta, el LED y el visor. Las capas estan en porcentajes medidos sobre la
 * imagen (1671 x 941): si cambia la imagen, hay que medirlas de nuevo (brand.css). Es
 * decorativa (el titulo y el texto dicen que paso). Sin boton de pausa por decision del
 * responsable; con reducir movimiento todo queda quieto.
 */
export function ErrorState({
  title,
  description,
  detail,
  icon: Icon = AlertTriangle,
  actions,
  className,
}: ErrorStateProps) {
  return (
    <section
      className={cn(
        "mx-auto flex max-w-2xl flex-col items-center gap-2 rounded-xl border border-border bg-card px-8 py-10 text-center",
        className
      )}
    >
      <div data-slot="error-scene" aria-hidden="true" className="error-scene">
        <div className="error-scene-float">
          <Image
            src="/images/estados/robot-error.webp"
            alt=""
            width={1671}
            height={941}
            sizes="(max-width: 640px) 100vw, 560px"
            className="error-scene-art"
          />
          <div className="error-scene-screen">
            <div className="error-scene-scan" />
            <div className="error-scene-flicker" />
          </div>
          <div className="error-scene-alert" />
          <div className="error-scene-led" />
          <div className="error-scene-visor" />
          <div className="error-scene-smoke error-scene-smoke-monitor" />
          <div className="error-scene-smoke error-scene-smoke-torch" />
          <div className="error-scene-glow" />
          <svg className="error-scene-spark" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19" />
          </svg>
          {/* Tres chispas sueltas: su direccion la pone brand.css. */}
          <span className="error-scene-particle" />
          <span className="error-scene-particle" />
          <span className="error-scene-particle" />
        </div>
        <span
          data-slot="error-scene-icon"
          className="absolute right-[15%] bottom-2 z-10 flex size-[38px] items-center justify-center rounded-full border-4 border-card bg-destructive-surface text-destructive-foreground"
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      </div>

      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      {description ? (
        <p className="max-w-[420px] text-[0.8125rem] leading-5 text-muted-foreground">{description}</p>
      ) : null}

      {detail ? (
        <details className="group mt-2.5 w-full max-w-[460px] rounded-md border border-border bg-background text-left">
          <summary className="cursor-pointer list-none px-3.5 py-2.5 text-xs font-semibold text-foreground group-open:border-b group-open:border-border [&::-webkit-details-marker]:hidden">
            Detalle técnico
          </summary>
          <p className="px-3.5 py-2.5 font-mono text-xs leading-[18px] break-words text-muted-foreground">{detail}</p>
        </details>
      ) : null}

      {actions ? <div className="mt-3.5 flex flex-col gap-3 sm:flex-row">{actions}</div> : null}
    </section>
  );
}
