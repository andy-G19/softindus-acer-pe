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
};

export function KpiCard({ title, value, description, href }: KpiCardProps) {
  const content = (
    <Card
      className={cn(
        "relative h-full border border-border/80 bg-card transition shadow-[0_14px_35px_rgba(0,0,0,0.18)] before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-primary/70",
        href &&
          "hover:-translate-y-0.5 hover:border-primary/55 hover:bg-secondary hover:shadow-[0_18px_42px_rgba(0,0,0,0.28)]"
      )}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        <p className="text-3xl font-bold text-foreground">{value}</p>
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
