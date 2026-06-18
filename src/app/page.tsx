import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <Badge className="w-fit" variant="secondary">
            Fase 0 en progreso
          </Badge>

          <CardTitle className="text-4xl">
            Industrias Aceros Perú
          </CardTitle>

          <CardDescription className="text-base">
            Sistema de Gestión Integral desarrollado con Next.js, TypeScript,
            Tailwind CSS, shadcn/ui, PostgreSQL, Prisma y Auth.js.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-background p-5">
            <p className="font-medium">Estado del proyecto</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Los componentes UI iniciales han sido instalados correctamente.
              El siguiente paso será configurar las variables de entorno.
            </p>
          </div>

          <Button>Continuar desarrollo</Button>
        </CardContent>
      </Card>
    </main>
  );
}