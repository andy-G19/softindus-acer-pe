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
        "h-full border bg-card/95 transition",
        href && "hover:-translate-y-0.5 hover:bg-background hover:shadow-sm"
      )}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
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
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}
