import type { CSSProperties } from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  description: string;
  href?: string;
  tone?: "success" | "warning" | "info";
};

const kpiToneVariables = {
  success: "var(--accent-forge)",
  warning: "var(--accent-ember)",
  info: "var(--accent-steel)",
} satisfies Record<NonNullable<KpiCardProps["tone"]>, string>;

export function KpiCard({
  title,
  value,
  description,
  href,
  tone = "info",
}: KpiCardProps) {
  const content = (
    <Card
      style={
        {
          "--kpi-tone": kpiToneVariables[tone],
        } as CSSProperties & Record<"--kpi-tone", string>
      }
      className={cn(
        "relative h-full border border-border/80 bg-card shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition duration-150 ease-out [--card-spacing:20px] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[var(--kpi-tone)]",
        href &&
          "hover:-translate-y-[2px] hover:border-border hover:bg-secondary hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.4)]"
      )}
    >
      <CardHeader className="pb-1">
        <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        <p className="font-mono text-3xl font-bold text-[var(--kpi-tone)]">
          {value}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
    >
      {content}
    </Link>
  );
}
