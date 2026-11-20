import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  label: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  label,
  description,
  icon: Icon,
  action,
  className,
}: EmptyStateProps) {
  // Diseno de mensajes y estados (2026-11-19): borde discontinuo de acero y ningun fondo, porque
  // el vacio no es un error. Solo con su texto, una linea atenuada; con icono, descripcion o
  // accion, el texto es el titulo.
  const plain = !Icon && !description && !action;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-control-border px-6 py-9 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="mb-1.5 flex size-11 items-center justify-center rounded-full bg-accent text-muted-foreground">
          <Icon className="size-[21px]" aria-hidden="true" />
        </span>
      ) : null}

      {plain ? (
        <p className="text-[0.8125rem] text-muted-foreground">{label}</p>
      ) : (
        <>
          <p className="text-[0.9375rem] font-semibold text-foreground">{label}</p>
          {description ? (
            <p className="max-w-[360px] text-[0.8125rem] text-muted-foreground">{description}</p>
          ) : null}
        </>
      )}

      {action ? <div className="mt-2.5">{action}</div> : null}
    </div>
  );
}
