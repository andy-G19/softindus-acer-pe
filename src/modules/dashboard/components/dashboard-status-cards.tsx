import type { Session } from "next-auth";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoleLabel, getUserStatusLabel } from "@/lib/permissions";

type DashboardStatusCardsProps = {
  session: Session;
};

export function DashboardStatusCards({ session }: DashboardStatusCardsProps) {
  return (
    <section>
      <Card className="rounded-xl border border-border/80 bg-card shadow-[0_14px_35px_rgba(0,0,0,0.18)] [--card-spacing:20px]">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-[19px] font-semibold leading-tight text-foreground">
            Sesión actual
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Usuario
            </p>
            <p className="truncate text-sm font-medium text-foreground">
              {session.user.name}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Correo</p>
            <p className="truncate font-mono text-sm text-foreground">
              {session.user.email}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Rol
            </span>
            <Badge>{getRoleLabel(session.user.role)}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Estado
            </span>
            <Badge variant="success">
              {getUserStatusLabel(session.user.status)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
