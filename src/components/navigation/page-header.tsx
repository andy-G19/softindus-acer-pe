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
    <section className="space-y-3">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              {description}
            </p>
          ) : null}
        </div>

        {hasControls ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
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
