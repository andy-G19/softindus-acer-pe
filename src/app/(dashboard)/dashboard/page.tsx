import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/authz";
import { getRoleLabel, getUserStatusLabel } from "@/lib/permissions";

export default async function DashboardPage() {
  const session = await requireAuth();

  const role = session.user.role;

  const canAccessCommercial = ["ADMIN", "SELLER"].includes(role);
  const canAccessInventory = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessProduction = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessWasteScrap = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canAccessCosts = role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Bienvenido al panel principal del sistema.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usuario autenticado</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">Nombre:</span>{" "}
              {session.user.name}
            </p>

            <p className="text-sm">
              <span className="font-medium">Correo:</span>{" "}
              {session.user.email}
            </p>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Rol:</span>
              <Badge>{getRoleLabel(session.user.role)}</Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Estado:</span>
              <Badge variant="secondary">
                {getUserStatusLabel(session.user.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seguridad</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Esta pantalla solo puede visualizarse con una sesión activa.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fase actual</CardTitle>
          </CardHeader>

          <CardContent>
            <Badge variant="secondary">
              Fase 6 — Mermas, retazos y chatarra
            </Badge>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-xl font-semibold">Módulos del sistema</h3>
          <p className="text-sm text-muted-foreground">
            Accede rápidamente a los módulos implementados del sistema.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {canAccessCommercial ? (
            <Link href="/dashboard/commercial" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Módulo comercial
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Clientes, productos, pedidos, proformas, pagos y
                    comprobantes.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessInventory ? (
            <Link href="/dashboard/inventory" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Inventario y proveedores
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Control de materiales, stock, proveedores, compras y
                    abastecimiento.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessProduction ? (
            <Link href="/dashboard/production" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Producción y recetas técnicas
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Órdenes de trabajo, rutas de fabricación, etapas, avances y
                    recetas técnicas.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessWasteScrap ? (
            <Link href="/dashboard/waste-scrap" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Mermas y chatarra
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Registro de retazos reutilizables, chatarra generada,
                    ventas de chatarra y destino del dinero.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {canAccessCosts ? (
            <Link href="/dashboard/costs" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Costos y rentabilidad
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Costeo de producción, costos indirectos, márgenes, precios
                    sugeridos y utilidad estimada.
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}