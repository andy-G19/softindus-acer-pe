import type { ReactNode } from "react";
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
        "mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]",
        className
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon className="size-6" aria-hidden="true" />
      </span>

      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {detail ? (
        <div className="w-full rounded-xl border border-border bg-secondary/60 p-4 text-left text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Detalle técnico:</p>
          <p className="mt-1 break-words">{detail}</p>
        </div>
      ) : null}

      {actions ? (
        <div className="flex flex-col gap-3 sm:flex-row">{actions}</div>
      ) : null}
    </section>
  );
}
