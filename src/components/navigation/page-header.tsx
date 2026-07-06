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
    <section className="max-w-full space-y-3 overflow-hidden">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}

      <div className="flex min-w-0 flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="break-words text-2xl font-bold tracking-tight md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              {description}
            </p>
          ) : null}
        </div>

        {hasControls ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:max-w-[50%] md:justify-end">
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
