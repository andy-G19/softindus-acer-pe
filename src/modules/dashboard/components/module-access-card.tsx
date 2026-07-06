import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ModuleAccessCardProps = {
  title: string;
  description: string;
  href: string;
};

export function ModuleAccessCard({
  title,
  description,
  href,
}: ModuleAccessCardProps) {
  return (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
    >
      <Card className="h-full border border-border/80 bg-card transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-secondary hover:shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            {title}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
