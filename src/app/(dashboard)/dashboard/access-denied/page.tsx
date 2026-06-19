import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AccessDeniedPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acceso denegado</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No tienes permisos para acceder a esta sección del sistema.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Volver al dashboard
        </Link>
      </CardContent>
    </Card>
  );
}