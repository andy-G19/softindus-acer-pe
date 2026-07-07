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
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 bg-secondary/45 px-4 py-6 text-center text-sm text-muted-foreground",
        className
      )}
    >
      {Icon ? (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
      ) : null}

      <div className="space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        {description ? <p>{description}</p> : null}
      </div>

      {action}
    </div>
  );
}
