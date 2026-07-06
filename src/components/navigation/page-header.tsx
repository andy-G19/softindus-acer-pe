import type { ReactNode } from "react";

import { BackButton } from "@/components/navigation/back-button";
import {
  Breadcrumbs,
  type BreadcrumbItem,
} from "@/components/navigation/breadcrumbs";

type PageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  const hasControls = Boolean(backHref || actions);

  return (
    <section className="max-w-full space-y-4 overflow-hidden border-b border-border/70 pb-6">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}

      <div className="flex min-w-0 flex-col justify-between gap-5 md:flex-row md:items-start">
        <div className="min-w-0 flex-1 space-y-2 border-l-2 border-primary/70 pl-4">
          <h1 className="break-words text-3xl font-semibold leading-tight text-foreground md:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground md:text-[0.95rem]">
              {description}
            </p>
          ) : null}
        </div>

        {hasControls ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:max-w-[50%] md:justify-end md:pt-1">
            {backHref ? (
              <BackButton
                fallbackHref={backHref}
                label={backLabel ?? "Volver"}
              />
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
