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
    <Link href={href} className="block h-full">
      <Card className="h-full border bg-card/95 transition hover:-translate-y-0.5 hover:bg-background hover:shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
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
